const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * Converts image file to base64
 * @param {string} imagePath - Path to image file
 * @returns {string} Base64 encoded image
 */
const imageToBase64 = (imagePath) => {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
};

/**
 * Builds HTML template for PDF generation with logos
 * @param {string|object} reportData - JSON string or parsed object containing report data
 * @param {object} assessment - Assessment object with user details
 * @param {string} assetsPath - Path to assets directory
 * @returns {string} HTML template for PDF
 */
const buildPDFHTMLTemplate = (reportData, assessment, assetsPath = null) => {
  let parsedReport;
  try {
    parsedReport = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
  } catch (err) {
    console.error("Failed to parse report JSON", err);
    parsedReport = {};
  }

  // Get absolute path to assets directory
  if (!assetsPath) {
    assetsPath = path.join(__dirname, '..', 'assets');
  }
  
  // Convert logos to base64
  const logoPath = path.join(assetsPath, 'inflecto-logo.png');
  const watermarkPath = path.join(assetsPath, 'inflecto-water-mark.png');
  
  let logoBase64 = '';
  let watermarkBase64 = '';
  
  try {
    if (fs.existsSync(logoPath)) {
      logoBase64 = imageToBase64(logoPath);
    } else {
      console.warn('Logo image not found:', logoPath);
    }
  } catch (err) {
    console.warn('Error loading logo:', err.message);
  }
  
  try {
    if (fs.existsSync(watermarkPath)) {
      watermarkBase64 = imageToBase64(watermarkPath);
    } else {
      console.warn('Watermark image not found:', watermarkPath);
    }
  } catch (err) {
    console.warn('Error loading watermark:', err.message);
  }

  const personaLabel = {
    'c_suite': 'C-Suite / Decision Maker',
    'manager': 'Manager / Functional Head',
    'practitioner': 'Practitioner / Contributor / Analyst'
  }[assessment.persona] || assessment.persona;

  // Format date function
  const formatDate = (dateValue) => {
    if (!dateValue) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        // If date parsing fails, return current date
        return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (err) {
      console.warn('Date formatting error:', err);
      return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  };

  // Always use the database created_at date as the source of truth, ignore OpenAI-generated date
  const reportDate = assessment.created_at || new Date().toISOString();
  const assessmentDate = formatDate(reportDate);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Readiness Assessment Report</title>
  <style>
    @page {
      size: A4;
      margin: 0;
      padding: 0;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #ffffff;
      padding: 0;
    }
    .violet-bg {
      background-color: #B978B2;
      width: 50px;
      height: 10px;
    }
    .blue-bg {
      background-color: #70CBCF;
      width: 50px;
      height: 10px;
    }
    .yellow-bg {
      background-color: #E7E62A;
      width: 50px;
      height: 10px;
    }
    .red-bg {
      background-color: #E46356;
      width: 50px;
      height: 10px;
    }
    .document {
      width: 100%;
      position: relative;
    }
    
    .page-section {
      width: 210mm;
      height: 297mm;
      position: relative;
      padding-bottom: 50px;
      overflow: hidden;
      page-break-after: always;
      page-break-inside: avoid;
      box-sizing: border-box;
    }
    
    .page-section:last-child {
      page-break-after: avoid;
    }
    
    .page-margin {
      padding: 0 40px;
      box-sizing: border-box;
    }
    
    .page-footer {
      position: absolute;
      bottom: 0;
      left: 40px;
      right: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e0e0e0;
      padding-top: 10px;
      margin-top: 20px;
      box-sizing: border-box;
    }
    
    .page-footer-left {
      text-align: left;
    }
    
    .page-footer-right {
      text-align: right;
    }

.watermark {
  position: absolute;
  top: 50%;
  left: 50%;

  transform: translate(-50%, -50%);

  width: 100%;
  height: 100%;

  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  opacity: 0.6;
  pointer-events: none;
  z-index: 10;
}

.watermark img {
  width: 420px;
  height: auto;
  object-fit: contain;
}


    
    .content-wrapper {
      position: relative;
      z-index: 1;
      height: 100%;
      overflow: hidden;
    }
    
    .header {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 1px solid #70CBCF26;
      page-break-inside: avoid;
    }
    .header-main {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      margin-bottom: 10px;
      height: 150px;
      padding-horizontal: 25px;
      background-color: #70CBCF26;
      page-break-inside: avoid;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-section-main {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding-vertical: 25px;
    }
    
    .logo-section img {
      height: 30px;
      width: auto;
      object-fit: contain;
      margin-right: 10px;
      margin-top: 5px;
    }
    
    .logo-text {
      font-size: 18px;
      font-weight: bold;
      color: #1a1a1a;
      letter-spacing: 0.5px;
    }
    
    .title {
      font-size: 24px;
      font-weight: bold;
      color: #2B7B7E;
      margin-bottom: 10px;
      text-align: center;
      page-break-after: avoid;
    }
    
    .assessment-details {
      background-color: #f8f9fa;
      padding: 15px 20px;
      border-radius: 6px;
      margin-bottom: 25px;
      border-left: 4px solid #5acfd5;
      page-break-inside: avoid;
    }
    
    .assessment-details p {
      margin: 5px 0;
      color: #333;
      font-size: 12px;
    }
    .score-p {
      margin: 5px 0;
      color: black;
      font-size: 12px;
    }
    .thank-you {
      background-color: #f0f9fa;
      padding: 15px 20px;
      border-radius: 6px;
      margin-bottom: 25px;
      font-size: 12px;
      line-height: 1.5;
      color: #333;
      border-left: 4px solid #5acfd5;
      page-break-inside: avoid;
    }
    
    .score-value {
      font-size: 30px;
      font-weight: bold;
      margin: 5px 0;
    }
    
    .stage {
      font-size: 12px;
      font-weight: 600;
      margin-top: 5px;
    }
    
    .interpretation {
      margin: 20px 0;
      font-size: 12px;
      line-height: 1.5;
      color: #333;
      page-break-inside: avoid;
    }
    
    .section {
      margin: 25px 0;
      page-break-inside: avoid;
    }
    
    .section-title {
      color: #27A6F5;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 5px;
      padding-bottom: 2px;
      page-break-after: avoid;
    }
    
    .section ul {
      list-style: none;
      padding-left: 0;
    }
    
    .section ul li {
      padding: 2px 0;
      padding-left: 20px;
      position: relative;
      font-size: 12px;
      line-height: 1.2;
      color: #000;
      page-break-inside: avoid;
    }
    
    .section ul li:before {
      content: "•";
      position: absolute;
      left: 0;
      color: #000;
      font-weight: bold;
      font-size: 12px;
    }
    
    .section ol {
      list-style: none;
      padding-left: 0;
      counter-reset: step-counter;
    }
    
    .section ol li {
      padding: 2px 0;
      padding-left: 25px;
      position: relative;
      font-size: 12px;
      line-height: 1.2;
      color: #000;
      counter-increment: step-counter;
      page-break-inside: avoid;
    }
    
    .section ol li:before {
      content: counter(step-counter) ".";
      position: absolute;
      left: 0;
      color: #000;
      font-weight: bold;
      font-size: 12px;
    }
    
    .highlight-box {
      background-color: #f0f9fa;
      border-left: 4px solid #5acfd5;
      padding: 5px 10px;
      margin: 5px 0;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    
    .highlight-box h3 {
      color: #1a1a1a;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .highlight-box p {
      font-size: 12px;
      line-height: 1.5;
      color: #333;
    }
    
    .cta-section {
      color: #000;
      padding: 10px;
      font-weight: 600;
      font-size: 12px;
      page-break-inside: avoid;
    }
    
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    
    .no-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Ensure proper spacing for page breaks */
    .section, .highlight-box, .cta-section {
      orphans: 3;
      widows: 3;
    }
  </style>
</head>
<body>
  <div class="document">
    <!-- Page 1 -->
    <div class="page-section">
      ${watermarkBase64 ? `<div class="watermark"><img src="data:image/png;base64,${watermarkBase64}" alt="Watermark" /></div>` : ''}
      <div class="content-wrapper">
        <!-- Header -->
        <div class="header-main">
          <div class="logo-section-main">
            ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Inflecto Logo" />` : ''}
          </div>
        <div class="title">AI Readiness Assessment Report : ${personaLabel}</div>

        </div>
        
        <div class="page-margin">
        <!-- Assessment Details -->
        <div class="assessment-details">
          <p><strong>Prepared for:</strong> ${parsedReport.prepared_for || assessment.user_name || 'User'}</p>
          ${assessment.company_name ? `<p><strong>Organization:</strong> ${assessment.company_name}</p>` : ''}
          <p><strong>Assessment Date:</strong> ${assessmentDate}</p>
        </div>
        
        <!-- Thank You Section -->
        <div class="thank-you">
          <p>Thank you for completing the AI Readiness Assessment. Based on your role and responses, this report summarizes your current readiness to adopt AI and highlights next steps to unlock measurable value. This is a short, role-specific assessment. Deeper, enterprise-wide insights are available through Inflecto Technologies' ART (AI Readiness Tool).</p>
        </div>
        
        <!-- Score Section -->
        <div class="section">
          <h2 class="section-title">AI Readiness Score</h2>
          <div class="score-p">${parsedReport.score_section?.score || assessment.final_score || 0} / 100</div>
          <div class="score-p">Stage: ${parsedReport.score_section?.stage || assessment.stage || 'N/A'}</div>
        </div>
        
        <!-- Interpretation -->
        ${parsedReport.score_section?.interpretation ? `
        <div class="interpretation">
          <p>${parsedReport.score_section.interpretation}</p>
        </div>
        ` : ''}
        
        <!-- Key Observations -->
        ${parsedReport.key_observations && parsedReport.key_observations.length > 0 ? `
        <div class="section">
          <h3 class="section-title">Key Observations (Limited View)</h3>
          <ul>
            ${parsedReport.key_observations.map(obs => `<li>${obs}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        <!-- Areas of Opportunity -->
        ${parsedReport.areas_of_opportunity && parsedReport.areas_of_opportunity.length > 0 ? `
        <div class="section">
          <h3 class="section-title">Areas of Opportunity (Indicative)</h3>
          <ul>
            ${parsedReport.areas_of_opportunity.map(opp => `<li>${opp}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        <!-- Recommended Next Steps -->
        ${parsedReport.recommended_next_steps && parsedReport.recommended_next_steps.length > 0 ? `
        <div class="section">
          <h3 class="section-title">Recommended Next Steps</h3>
          <ol>
            ${parsedReport.recommended_next_steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
        </div>
        ` : ''}
      </div>
      </div>
      <!-- Footer for Page 1 -->
      <div class="page-footer">
        <div class="page-footer-left">www.inflecto.ai</div>
        <div class="page-footer-right">Page 1</div>
      </div>
    </div>
    
    <!-- Page 2 -->
    <div class="page-section page-break">
      ${watermarkBase64 ? `<div class="watermark"><img src="data:image/png;base64,${watermarkBase64}" alt="Watermark" /></div>` : ''}
      <div class="content-wrapper">
        <!-- Second Page Header -->
        <div class="header">
          <div class="logo-section">
            ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Inflecto Logo" />` : ''}
          </div>
        </div>
        <div class="page-margin">

        <!-- Why Beginning -->
        ${parsedReport.why_beginning ? `
        <div class="highlight-box">
          <h3>Why This Quick Assessment Is Only The Beginning</h3>
          <p>${parsedReport.why_beginning}</p>
        </div>
        ` : ''}
        
        <!-- ART Benefits -->
        <div class="section">
          <h3 class="section-title">What ART (AI Readiness Tool) Gives You Beyond This Report</h3>
          <p style="margin-bottom: 5px; font-size: 12px; line-height: 1.5;">This quick assessment only evaluates readiness based on your persona. ART evaluates your entire organization across 100+ strategic dimensions, including:</p>
          ${ `
          <ul>
            <li>Leadership strategy & alignment</li>
            <li>Cross-functional AI adoption</li>
            <li>Data foundation & governance</li>
            <li>Workflow automation readiness</li>
            <li>AI maturity across departments</li>
            <li>Talent, skills & upskilling</li>
            <li>Responsible AI & risk</li>
            <li>Change readiness</li>
            <li>MLOps, deployment & scaling</li>
          </ul>
          `}
        </div>
        
        <!-- Sample ART Questions -->
        ${parsedReport.glimpse_questions && parsedReport.glimpse_questions.length > 0 ? `
        <div class="section">
          <h3 class="section-title">Sample ART Questions (Much Deeper Than This Quiz)</h3>
          <ul>
            ${parsedReport.glimpse_questions.map(q => `<li>${q}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        <!-- How ART Complements -->
        <div class="section">
          <h3 class="section-title">How ART Complements This Report</h3>
          <ul>
            <li>Persona-level snapshot → Enterprise-level readiness</li>
            <li>Quick score → Prioritized roadmap</li>
            <li>Light maturity check → Deep maturity diagnostics</li>
            <li>Basic insights → Business case modeling</li>
            <li>Personal view → Organizational alignment</li>
          </ul>
        </div>
        
        ${`
        <div class="section">
            <h3 class="section-title">Interested in a full ART assessment?</h3>
          <p style="margin-bottom: 5px; font-size: 12px; line-height: 1.5;">If you'd like to run a full ART assessment for your organization and receive a detailed AI Readiness Blueprint, write to cs@inflectotechnologies.com<br/> Mention "ART Assessment – ${assessment.company_name || 'Your Organization'}" in the subject line and our team will guide you through the next steps.</p>
        </div>
        `}
    
      </div>
      </div>
      <!-- Footer for Page 2 -->
      <div class="page-footer">
        <div class="page-footer-left">www.inflecto.ai</div>
        <div class="page-footer-right">Page 2</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Generates PDF from HTML template
 * @param {string|object} reportData - JSON string or parsed object containing report data
 * @param {object} assessment - Assessment object with user details
 * @param {string} assetsPath - Path to assets directory
 * @returns {Promise<Buffer>} PDF buffer
 */
const generatePDF = async (reportData, assessment, assetsPath = null) => {
  let browser;
  try {
    const html = buildPDFHTMLTemplate(reportData, assessment, assetsPath);
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      },
      displayHeaderFooter: false,
      preferCSSPageSize: true
    });
    
    await browser.close();
    return pdf;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('PDF generation error:', error);
    throw error;
  }
};

module.exports = {
  buildPDFHTMLTemplate,
  generatePDF,
  imageToBase64,
};
