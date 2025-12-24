const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { WebSocketServer } = require("ws");
const pool = require("../database");
const { OpenAI } = require("openai");
const nodemailer = require("nodemailer");
const { buildEmailTemplate } = require("../utils/emailTemplates");
const { generatePDF } = require("../utils/pdfTemplates");

const questionsPath = path.join(__dirname, "..", "utils", "questions.json");
const questionsData = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const ensureTables = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS aireadiness (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_name VARCHAR(255),
        company_name VARCHAR(255),
        email VARCHAR(255),
        persona VARCHAR(50) NOT NULL CHECK (persona IN ('c_suite','manager','practitioner')),
        final_score NUMERIC(5,2),
        stage VARCHAR(50),
        report TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS aiquestionnaire (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        aireadiness_id UUID NOT NULL REFERENCES aireadiness(id) ON DELETE CASCADE,
        persona VARCHAR(50) NOT NULL,
        question_id VARCHAR(50) NOT NULL,
        question TEXT NOT NULL,
        question_type VARCHAR(10) NOT NULL CHECK (question_type IN ('single','multi')),
        selected_answer TEXT NOT NULL,
        selected_score INT,
        is_scoring BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
};

ensureTables().catch((err) => {
  console.error("Error ensuring tables (will continue without blocking):", err.message);
});

const stageFromScore = (score) => {
  if (score <= 40) return "Early-Stage AI";
  if (score <= 60) return "Developing";
  if (score <= 75) return "Transforming";
  return "AI-Mature";
};

const buildQuestions = (personaKey) => {
  const persona = questionsData[personaKey];
  if (!persona) return [];

  const scoringQs =
    persona.scoring?.map((q) => ({
      id: q.id,
      text: q.question,
      type: q.type,
      options: Object.keys(q.options),
      scoring: true,
      scores: q.options,
    })) || [];

  const nonScoringQs =
    persona.non_scoring?.map((q) => ({
      id: q.id,
      text: q.question,
      type: q.type,
      options: Array.isArray(q.options) ? q.options : [],
      scoring: false,
    })) || [];

  return [...scoringQs, ...nonScoringQs];
};

// REST endpoint to fetch first N questions for a persona (optional helper)
const getQuestions = (req, res) => {
  const persona = req.query.persona;
  if (!persona || !questionsData[persona]) {
    return res.status(400).json({ error: "Invalid or missing persona" });
  }
  const questions = buildQuestions(persona).slice(0, 5);
  return res.json({ persona, total: questions.length, questions });
};

const createAssessment = async (req, res) => {
  const { user_name, company_name, email, persona } = req.body || {};
  if (!persona || !questionsData[persona]) {
    return res.status(400).json({ error: "Invalid persona" });
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO aireadiness (user_name, company_name, email, persona)
       VALUES ($1,$2,$3,$4)
       RETURNING id, persona, user_name, company_name, email`,
      [user_name || null, company_name || null, email || null, persona]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("createAssessment error", err);
    return res.status(500).json({ error: "Failed to create assessment" });
  } finally {
    client.release();
  }
};

const saveAnswer = async (req, res) => {
  const { id } = req.params;
  const {
    persona,
    question_id,
    question,
    question_type,
    selected_answer,
    selected_score = null,
    is_scoring = false,
  } = req.body || {};

  if (!id || !persona || !question_id || !question || !question_type || !selected_answer) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO aiquestionnaire
        (aireadiness_id, persona, question_id, question, question_type, selected_answer, selected_score, is_scoring)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, persona, question_id, question, question_type, selected_answer, selected_score, is_scoring]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("saveAnswer error", err);
    return res.status(500).json({ error: "Failed to save answer" });
  } finally {
    client.release();
  }
};

const finalizeAssessment = async (req, res) => {
  const { id } = req.params;
  const { final_score, stage, email = null, company_name = null, user_name = null } = req.body || {};
  if (!id || final_score === undefined || !stage) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    // Update summary row
    await client.query(
      `UPDATE aireadiness
         SET final_score = $1,
             stage = $2,
             email = COALESCE($3, email),
             company_name = COALESCE($4, company_name),
             user_name = COALESCE($5, user_name),
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [final_score, stage, email, company_name, user_name, id]
    );

    // Fetch assessment and answers to return as JSON template payload
    const assessmentRes = await client.query(
      `SELECT id, user_name, company_name, email, persona, final_score, stage, report, created_at, updated_at
         FROM aireadiness
        WHERE id = $1`,
      [id]
    );

    const answersRes = await client.query(
      `SELECT question_id, question, question_type, selected_answer, selected_score, is_scoring, created_at
         FROM aiquestionnaire
        WHERE aireadiness_id = $1
        ORDER BY created_at ASC`,
      [id]
    );

    const assessment = assessmentRes.rows[0] || null;
    const answers = answersRes.rows || [];
    let generatedReport = assessment?.report || null;
    if (openai && assessment) {
      try {
        const prompt = buildReportJsonPrompt(assessment, answers);
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an AI readiness consultant. Return ONLY valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        });
        generatedReport = completion.choices?.[0]?.message?.content || generatedReport;
      } catch (err) {
        console.error("OpenAI generation failed", err.message);
      }
    }

    if (generatedReport) {
      await client.query(
        `UPDATE aireadiness
           SET report = $1,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [generatedReport, id]
      );
    }

    const payload = {
      assessment: { ...assessment, report: generatedReport },
      answers,
    };

    return res.json({ ok: true, data: payload });
  } catch (err) {
    console.error("finalizeAssessment error", err);
    return res.status(500).json({ error: "Failed to finalize assessment" });
  } finally {
    client.release();
  }
};


const sendReport = async (req, res) => {
  const { id } = req.params;
  const { email = null, company_name = null, user_name = null } = req.body || {};
  if (!id || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    const assessmentRes = await client.query(
      `SELECT id, user_name, company_name, email, persona, final_score, stage, report, created_at, updated_at
         FROM aireadiness
        WHERE id = $1`,
      [id]
    );
    const assessment = assessmentRes.rows[0];
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const answersRes = await client.query(
      `SELECT question_id, question, question_type, selected_answer, selected_score, is_scoring, created_at
         FROM aiquestionnaire
        WHERE aireadiness_id = $1
        ORDER BY created_at ASC`,
      [id]
    );
    const answers = answersRes.rows || [];

    let generatedReport = assessment.report || null;
    // if (!generatedReport && openai) {
    //   try {
    //     const prompt = buildReportJsonPrompt(assessment, answers);
    //     const completion = await openai.chat.completions.create({
    //       model: "gpt-4o-mini",
    //       messages: [
    //         { role: "system", content: "You are an AI readiness consultant. Return ONLY valid JSON." },
    //         { role: "user", content: prompt },
    //       ],
    //       temperature: 0.4,
    //     });
    //     generatedReport = completion.choices?.[0]?.message?.content || generatedReport;
    //   } catch (err) {
    //     console.error("OpenAI generation failed", err.message);
    //   }
    // }

    if (generatedReport) {
      await client.query(
        `UPDATE aireadiness
           SET report = $1,
               email = COALESCE($2, email),
               company_name = COALESCE($3, company_name),
               user_name = COALESCE($4, user_name),
               updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [generatedReport, email, company_name, user_name, id]
      );
    } else {
      return res.status(500).json({ error: "Report generation unavailable" });
    }

    // Send email with report
    try {
      // Validate email credentials
      console.log("📧 Email config check - SMTP_HOST:", process.env.SMTP_HOST);
      console.log("📧 Email config check - SMTP_USER:", process.env.SMTP_USER ? "✅ Set" : "❌ Missing");
      console.log("📧 Email config check - SMTP_PASS:", process.env.SMTP_PASS ? "✅ Set" : "❌ Missing");
      
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error("❌ SMTP credentials missing. SMTP_USER:", !!process.env.SMTP_USER, "SMTP_PASS:", !!process.env.SMTP_PASS);
        throw new Error("SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS in .env file");
      }

      // Configure nodemailer transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Generate PDF
      const updatedAssessment = { ...assessment, email, company_name, user_name };
      console.log("📄 Generating PDF...");
      const pdfBuffer = await generatePDF(generatedReport, updatedAssessment);
      console.log("✅ PDF generated successfully");

      // Email options with PDF attachment
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@inflectotechnologies.com',
        to: email,
        subject: `AI Readiness Assessment Report – ${updatedAssessment.company_name || 'Your Organization'}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #5acfd5;">Your AI Readiness Assessment Report is Ready</h2>
            <p>Dear ${updatedAssessment.user_name || 'User'},</p>
            <p>Thank you for completing the AI Readiness Assessment. Your detailed report is attached as a PDF.</p>
            <p><strong>Your Score:</strong> ${updatedAssessment.final_score || 0} / 100</p>
            <p><strong>Stage:</strong> ${updatedAssessment.stage || 'N/A'}</p>
            <p>Please find your comprehensive AI Readiness Assessment Report attached to this email.</p>
            <p>If you have any questions or would like to schedule a consultation, please don't hesitate to reach out by replying to this email.</p>
            <br>
            <p>Best regards,<br>Inflecto Technologies</p>
          </div>
        `,
        text: `Your AI Readiness Assessment Report is ready. Score: ${updatedAssessment.final_score || 0}/100, Stage: ${updatedAssessment.stage || 'N/A'}. Please see the attached PDF for the full report.`,
        attachments: [
          {
            filename: `AI_Readiness_Report_${updatedAssessment.company_name || 'Report'}_${Date.now()}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email with PDF sent successfully to ${email}:`, info.messageId);

      return res.json({
        ok: true,
        message: "Report sent successfully",
        emailSent: true,
        report: generatedReport,
        assessment: updatedAssessment,
      });
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError);
      // Still return success if report was generated, but log the email error
      return res.json({
        ok: true,
        message: "Report generated but email sending failed",
        emailSent: false,
        emailError: emailError.message,
        report: generatedReport,
        assessment: { ...assessment, email, company_name, user_name },
      });
    }
  } catch (err) {
    console.error("sendReport error", err);
    return res.status(500).json({ error: "Failed to send report" });
  } finally {
    client.release();
  }
};


const buildReportJsonPrompt = (assessment, answers) => {
  const scoringAnswers = answers.filter((a) => a.is_scoring);
  const nonScoringAnswers = answers.filter((a) => !a.is_scoring);

  const observations = scoringAnswers.map((a) => `${a.question}: ${a.selected_answer}`);
  const contextAnswers = nonScoringAnswers.map((a) => `${a.question}: ${a.selected_answer}`);

  // Format the assessment date
  const assessmentDate = assessment.created_at 
    ? new Date(assessment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `
You are an AI readiness consultant. Generate a short AI Readiness Assessment Report as JSON using the structure below. Return ONLY valid JSON.

Use this data:
Persona: ${assessment.persona}
Score: ${assessment.final_score}
Stage: ${assessment.stage}
Company Name: ${assessment.company_name || ""}
User Name: ${assessment.user_name || ""}
Assessment Date: ${assessmentDate}
Observations: ${JSON.stringify(observations)}
Context: ${JSON.stringify(contextAnswers)}

IMPORTANT INSTRUCTIONS FOR ARRAY FIELDS:
- "key_observations": Generate 3 items, each 20-25 words. Summarize insights from the scoring answers (Observations field). Analyze the persona, score, and stage to provide specific, actionable observations about the organization's current AI readiness state, strengths, and gaps.
- "areas_of_opportunity": Generate 3 items, each 20-25 words. Identify specific opportunities based on the persona, score, context answers, and observations. Focus on areas where AI can create measurable value, address identified challenges, gaps, or pain points mentioned in the context answers.
- "recommended_next_steps": Generate 3 items, each 20-25 words. Provide concrete, actionable next steps tailored to the persona and current stage. Steps should be prioritized, specific, and aligned with the organization's AI maturity level, identified opportunities, and the persona's role (C-Suite focuses on strategy/investment, Manager on workflow/department, Practitioner on tools/tasks).

JSON structure (all fields required):
{
  "title": "AI Readiness Assessment Report – {{Persona}}",
  "prepared_for": "{{User_Name}}",
  "date": "${assessmentDate}",
  "score_section": {
    "score": "{{Score}}",
    "stage": "{{Stage}}",
    "interpretation": "{{Paragraph}}"
  },
  "key_observations": ["item1 (20-25 words)","item2 (20-25 words)","item3 (20-25 words)"],
  "areas_of_opportunity": ["item1 (20-25 words)","item2 (20-25 words)","item3 (20-25 words)"],
  "recommended_next_steps": ["step1 (20-25 words)","step2 (20-25 words)","step3 (20-25 words)"],
  "why_beginning": "Most organizations realize 10–15% effort savings just by adopting AI in the right sequence. One-size does NOT fit all.",
  "art_benefits": [
    "maps maturity across leadership, data, automation, talent, and governance",
    "identifies quick wins",
    "prioritizes the right AI use cases",
    "builds a practical AI roadmap"
  ],
  "glimpse_questions": [
    "Are decisions data-driven?",
    "Do processes have automation potential?",
    "Do we measure AI ROI?",
    "How do we govern and monitor AI?",
    "What percentage of workflows already use automation?"
  ],
  "cta": "For a full ART assessment, email enquiries@inflectotechnologies.com with subject line ‘ART Assessment – ${assessment.company_name || ""}’.",
  "thank_you": "Short message thanking the user and inviting them to reach out for a personalized ART walkthrough."
}
`;
};

const initAIReadinessSocket = (server) => {
  const wss = new WebSocketServer({ server, path: "/ws/ai-readiness" });

  wss.on("connection", (ws) => {
    const state = {
      persona: null,
      questions: [],
      currentIndex: 0,
      answers: [],
      total: 0,
    };

    const send = (payload) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    const sendQuestion = () => {
      const question = state.questions[state.currentIndex];
      if (!question) {
        return finalize();
      }
      send({
        type: "question",
        question: {
          id: question.id,
          text: question.text,
          type: question.type,
          options: question.options,
          scoring: question.scoring,
          score_map: question.scores || null,
        },
        index: state.currentIndex + 1,
        total: state.total,
      });
    };

    const finalize = () => {
      const scoringQuestions = state.questions.filter((q) => q.scoring);

      let totalScore = 0;
      scoringQuestions.forEach((q) => {
        const ans = state.answers.find((a) => a.questionId === q.id);
        if (!ans || !ans.answer) return;
        const answerValue = Array.isArray(ans.answer) ? ans.answer[0] : ans.answer;
        const mapped = q.scores?.[answerValue];
        if (typeof mapped === "number") totalScore += mapped;
      });

      const raw = scoringQuestions.length ? totalScore / scoringQuestions.length : 0;
      const normalized = Math.max(0, Math.min(100, ((raw - 1) / 3) * 85));
      const rounded = Number(normalized.toFixed(1));

      send({
        type: "complete",
        assessment_id: state.assessmentId || null,
        score: rounded,
        stage: stageFromScore(rounded),
        answered: state.answers.length,
        total: state.total,
      });

      setTimeout(() => ws.close(1000, "complete"), 200);
    };

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
      if (data.type === "start" && data.persona) {
          state.persona = data.persona;
        state.assessmentId = data.assessmentId || null;
          const built = buildQuestions(data.persona);
          state.questions = built.slice(0, 5); // first 5 questions
          state.total = state.questions.length;
          state.currentIndex = 0;
          state.answers = [];

          send({ type: "ack", persona: data.persona, total: state.total });
          if (state.total === 0) {
            send({ type: "error", message: "No questions found for persona." });
            ws.close(1000, "no-questions");
            return;
          }
          sendQuestion();
          return;
        }

        if (data.type === "answer" && state.persona && state.currentIndex < state.total) {
          const question = state.questions[state.currentIndex];
          if (!question) return;

          const answerPayload = {
            questionId: question.id,
            answer: data.answer,
            scoring: question.scoring,
          };
          state.answers.push(answerPayload);
          state.currentIndex += 1;

          if (state.currentIndex >= state.total) {
            finalize();
          } else {
            sendQuestion();
          }
          return;
        }
      } catch (err) {
        send({ type: "error", message: "Invalid message format." });
      }
    });

    ws.on("error", () => ws.close());
  });
};

module.exports = {
  initAIReadinessSocket,
  getQuestions,
  createAssessment,
  saveAnswer,
  finalizeAssessment,
  sendReport,
};

