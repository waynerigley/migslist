const nodemailer = require('nodemailer');

// Create email transporter
let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} options.text - Plain text body (optional)
 */
async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    console.error('Email not configured - SMTP_HOST not set');
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"MIGS List" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      html,
      text
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

module.exports = { sendEmail, transporter };
