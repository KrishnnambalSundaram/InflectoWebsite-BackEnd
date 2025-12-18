import nodemailer from "nodemailer";

export const sendAssessmentEmail = async ({ to, report, assessment }) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER, // your email
      pass: process.env.EMAIL_PASS, // app password
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6">
      <h2>${report.title}</h2>

      <p><strong>Company:</strong> ${assessment.company_name}</p>
      <p><strong>Persona:</strong> ${assessment.persona}</p>
      <p><strong>Date:</strong> ${report.date}</p>

      <hr/>

      <h3>Score Summary</h3>
      <p><strong>Score:</strong> ${report.score_section.score}</p>
      <p><strong>Stage:</strong> ${report.score_section.stage}</p>
      <p>${report.score_section.interpretation}</p>

      <h3>Key Observations</h3>
      <ul>
        ${report.key_observations.map(i => `<li>${i}</li>`).join("")}
      </ul>

      <h3>Areas of Opportunity</h3>
      <ul>
        ${report.areas_of_opportunity.map(i => `<li>${i}</li>`).join("")}
      </ul>

      <h3>Recommended Next Steps</h3>
      <ul>
        ${report.recommended_next_steps.map(i => `<li>${i}</li>`).join("")}
      </ul>

      <p><strong>${report.thank_you}</strong></p>
      <p>${report.cta}</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Inflecto AI" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your AI Readiness Assessment Report",
    html,
    attachments: [
      {
        filename: "ai-readiness-report.json",
        content: JSON.stringify(report, null, 2),
        contentType: "application/json",
      },
    ],
  });
};
