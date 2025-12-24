require("dotenv").config();
const pool = require("../database");
const nodemailer = require("nodemailer");

// Insert a new record
exports.addContact = async (req, res) => {
  try {
    const { name, email, phone_number, service, message } = req.body;

    const result = await pool.query(
      `INSERT INTO contactus (name, email, service, message) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, service, message]
    );

    // Send email notification to SMTP_USER
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("SMTP credentials not configured. Skipping email notification.");
      } else {
        // Configure nodemailer transporter
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        // Email options
        const mailOptions = {
          from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@inflectotechnologies.com',
          to: process.env.SMTP_USER,
          subject: `New Contact Form Submission - ${service || 'General Inquiry'}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
              <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #5acfd5; margin-top: 0;">New Contact Form Submission</h2>
                <div style="margin-bottom: 20px;">
                  <p style="margin: 10px 0;"><strong style="color: #333;">Name:</strong> <span style="color: #666;">${name || 'N/A'}</span></p>
                  <p style="margin: 10px 0;"><strong style="color: #333;">Email:</strong> <span style="color: #666;">${email || 'N/A'}</span></p>
                  ${phone_number ? `<p style="margin: 10px 0;"><strong style="color: #333;">Phone:</strong> <span style="color: #666;">${phone_number}</span></p>` : ''}
                  <p style="margin: 10px 0;"><strong style="color: #333;">Service:</strong> <span style="color: #666;">${service || 'N/A'}</span></p>
                  ${message ? `<div style="margin-top: 20px;">
                    <strong style="color: #333; display: block; margin-bottom: 10px;">Message:</strong>
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; color: #666; white-space: pre-wrap;">${message}</div>
                  </div>` : ''}
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px; margin: 0;">This email was sent from the Inflecto Technologies contact form.</p>
              </div>
            </div>
          `,
          text: `
New Contact Form Submission

Name: ${name || 'N/A'}
Email: ${email || 'N/A'}
${phone_number ? `Phone: ${phone_number}\n` : ''}Service: ${service || 'N/A'}
${message ? `\nMessage:\n${message}` : ''}
          `.trim()
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Contact form email sent successfully to ${process.env.SMTP_USER}:`, info.messageId);
      }
    } catch (emailError) {
      console.error("❌ Error sending contact form email:", emailError);
      // Don't fail the request if email fails, just log it
    }

    res.status(201).json({
      message: "Contact record added successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error inserting contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all contacts (latest first)
exports.getAllContacts = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM contactus ORDER BY created_at DESC"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching contacts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteAllContacts = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM contactus"
    );
    res.status(200).json({ message: "All contacts deleted successfully." });
  } catch (error) {
    console.error("❌ Error deleting contacts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
