const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");

const questionsPath = path.join(__dirname, "..", "utils", "questions.json");
const questionsData = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));

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

module.exports = { initAIReadinessSocket, getQuestions };

