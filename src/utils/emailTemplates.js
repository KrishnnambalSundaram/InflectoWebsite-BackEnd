/**
 * Email template builder for AI Readiness Assessment Report
 * @param {string|object} reportData - JSON string or parsed object containing report data
 * @param {object} assessment - Assessment object with user details
 * @returns {string} HTML email template
 */
const buildEmailTemplate = (reportData, assessment) => {
  let parsedReport;
  try {
    parsedReport = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
  } catch (err) {
    console.error("Failed to parse report JSON", err);
    parsedReport = {};
  }

  const personaLabel = {
    'c_suite': 'C-Suite / Decision Maker',
    'manager': 'Manager / Functional Head',
    'practitioner': 'Practitioner / Contributor / Analyst'
  }[assessment.persona] || assessment.persona;

  const assessmentDate = assessment.created_at 
    ? new Date(assessment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Readiness Assessment Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #5acfd5;
    }
    .header h1 {
      color: #1a1a1a;
      font-size: 28px;
      margin: 0 0 10px 0;
    }
    .assessment-details {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
    }
    .assessment-details p {
      margin: 5px 0;
      color: #666;
    }
    .score-section {
      background: linear-gradient(135deg, #5acfd5 0%, #70CBCF 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      margin: 30px 0;
    }
    .score-section h2 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .score-value {
      font-size: 48px;
      font-weight: bold;
      margin: 10px 0;
    }
    .stage {
      font-size: 18px;
      font-weight: 600;
      margin-top: 10px;
    }
    .section {
      margin: 30px 0;
    }
    .section h3 {
      color: #1a1a1a;
      font-size: 20px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    .section ul {
      list-style: none;
      padding-left: 0;
    }
    .section ul li {
      padding: 10px 0;
      padding-left: 25px;
      position: relative;
    }
    .section ul li:before {
      content: "•";
      position: absolute;
      left: 0;
      color: #5acfd5;
      font-weight: bold;
      font-size: 20px;
    }
    .highlight-box {
      background-color: #f0f9fa;
      border-left: 4px solid #5acfd5;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .cta-section {
      background-color: #E7E62A;
      color: #1a1a1a;
      padding: 25px;
      border-radius: 8px;
      text-align: center;
      margin: 30px 0;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #666;
      font-size: 14px;
    }
    .thank-you {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${parsedReport.title || `AI Readiness Assessment Report – ${personaLabel}`}</h1>
    </div>

    <div class="assessment-details">
      <p><strong>Prepared for:</strong> ${parsedReport.prepared_for || assessment.user_name || 'User'}</p>
      ${assessment.company_name ? `<p><strong>Organization:</strong> ${assessment.company_name}</p>` : ''}
      <p><strong>Assessment Date:</strong> ${parsedReport.date || assessmentDate}</p>
    </div>

    <div class="thank-you">
      <p>${parsedReport.thank_you || 'Thank you for completing the AI Readiness Assessment. Based on your role and responses, this report summarizes your current readiness to adopt AI and highlights next steps to unlock measurable value. This is a short, role-specific assessment. A deeper cross-functional evaluation is available through our full ART (AI Readiness Tool) platform.'}</p>
    </div>

    <div class="score-section">
      <h2>Your AI Readiness Score</h2>
      <div class="score-value">${parsedReport.score_section?.score || assessment.final_score || 0} / 100</div>
      <div class="stage">Stage: ${parsedReport.score_section?.stage || assessment.stage || 'N/A'}</div>
    </div>

    ${parsedReport.score_section?.interpretation ? `
    <div class="section">
      <p>${parsedReport.score_section.interpretation}</p>
    </div>
    ` : ''}

    ${parsedReport.key_observations && parsedReport.key_observations.length > 0 ? `
    <div class="section">
      <h3>📌 Key Observations (Based on Your Responses)</h3>
      <ul>
        ${parsedReport.key_observations.map(obs => `<li>${obs}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${parsedReport.areas_of_opportunity && parsedReport.areas_of_opportunity.length > 0 ? `
    <div class="section">
      <h3>🔍 Areas of Opportunity</h3>
      <p>Based on your persona, here are opportunities that could create measurable AI value:</p>
      <ul>
        ${parsedReport.areas_of_opportunity.map(opp => `<li>${opp}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${parsedReport.recommended_next_steps && parsedReport.recommended_next_steps.length > 0 ? `
    <div class="section">
      <h3>🚀 Recommended Next Steps</h3>
      <p>To advance your AI maturity, we recommend the following actions aligned to your persona:</p>
      <ul>
        ${parsedReport.recommended_next_steps.map(step => `<li>${step}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${parsedReport.why_beginning ? `
    <div class="highlight-box">
      <h3>🧠 Why This Quick Assessment Is Only The Beginning</h3>
      <p>${parsedReport.why_beginning}</p>
    </div>
    ` : ''}

    ${parsedReport.art_benefits && parsedReport.art_benefits.length > 0 ? `
    <div class="section">
      <h3>🔮 What ART (AI Readiness Tool) Gives You Beyond This Report</h3>
      <p>This quick assessment only evaluates readiness based on your persona. ART evaluates your entire organization across 100+ strategic dimensions, including:</p>
      <ul>
        ${parsedReport.art_benefits.map(benefit => `<li>${benefit}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${parsedReport.glimpse_questions && parsedReport.glimpse_questions.length > 0 ? `
    <div class="section">
      <h3>🧩 Sample ART Questions (Much Deeper Than This Quiz)</h3>
      <ul>
        ${parsedReport.glimpse_questions.map(q => `<li>${q}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${parsedReport.cta ? `
    <div class="cta-section">
      <p>${parsedReport.cta}</p>
    </div>
    ` : ''}

    <div class="footer">
      <p><strong>Inflecto Technologies</strong></p>
      <p>AI Readiness & Acceleration Solutions</p>
      <p>www.inflecto.ai</p>
    </div>
  </div>
</body>
</html>
  `;
};

module.exports = {
  buildEmailTemplate,
};

