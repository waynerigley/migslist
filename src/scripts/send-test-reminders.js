#!/usr/bin/env node
/**
 * Send test reminder emails to trialending@migslist.com
 * Usage: node src/scripts/send-test-reminders.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const SUPPORT_EMAIL = 'support@migslist.com';
const APP_URL = 'https://migslist.com';

// Sample union data
const union15 = {
  name: 'CUPE Local 1234',
  subscription_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
};

const union5 = {
  name: 'CUPE Local 1234',
  subscription_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
};

function get15DayEmailHtml(union) {
  const endDate = new Date(union.subscription_end).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 14px; margin-top: 8px; }
    .content { background: #fffbeb; padding: 24px; border: 1px solid #fde68a; border-top: none; }
    .content h2 { color: #92400e; margin-top: 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 13px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
    .highlight { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>How's Your Trial Going?</h1>
      <span class="badge">15 days remaining</span>
    </div>
    <div class="content">
      <h2>Hi there!</h2>
      <p>We noticed you've been using MIGS List for <strong>${union.name}</strong> and wanted to check in.</p>

      <div class="highlight">
        <strong>We'd love to hear from you:</strong>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>How are you finding the system so far?</li>
          <li>Is there anything confusing or not working as expected?</li>
          <li>Do you need any help getting set up or importing members?</li>
        </ul>
      </div>

      <p>Your trial ends on <strong>${endDate}</strong>. We're here to help you get the most out of your trial!</p>

      <p>Just reply to this email with any questions or feedback - we read every message.</p>

      <a href="mailto:${SUPPORT_EMAIL}?subject=Trial Feedback - ${encodeURIComponent(union.name)}" class="btn">Share Your Feedback</a>
    </div>
    <div class="footer">
      <p><strong>MIGS List</strong> - Member Management for Unions<br>
      <a href="${APP_URL}" style="color: #2563eb;">migslist.com</a> | <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb;">${SUPPORT_EMAIL}</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

function get5DayEmailHtml(union) {
  const endDate = new Date(union.subscription_end).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.25); padding: 6px 16px; border-radius: 20px; font-size: 16px; font-weight: 700; margin-top: 8px; }
    .content { background: #fef2f2; padding: 24px; border: 1px solid #fecaca; border-top: none; }
    .content h2 { color: #991b1b; margin-top: 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 8px; }
    .btn-outline { background: white; color: #2563eb !important; border: 2px solid #2563eb; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 13px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
    .pricing { background: white; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center; border: 2px solid #22c55e; }
    .price { font-size: 36px; font-weight: 700; color: #059669; }
    .price-note { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Trial is Almost Over!</h1>
      <span class="badge">Only 5 days left</span>
    </div>
    <div class="content">
      <h2>Don't Lose Access to Your Data</h2>
      <p>We hope you've enjoyed using MIGS List for <strong>${union.name}</strong>!</p>

      <p>Your free trial ends on <strong>${endDate}</strong>. To keep your account active and retain all your member data, you'll need to subscribe.</p>

      <div class="pricing">
        <div class="price">$500 CAD</div>
        <div class="price-note">First year special (regularly $800/year)</div>
        <p style="margin: 12px 0 0 0; color: #374151;"><strong>Unlimited</strong> members, units, and admin accounts</p>
      </div>

      <p><strong>How to pay:</strong></p>
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li><strong>Interac e-Transfer</strong> to payments@migslist.com (fastest)</li>
        <li><strong>Cheque</strong> - Contact us for mailing instructions</li>
      </ul>

      <p>Need an invoice? Just reply to this email with your union's mailing address and we'll send one right over.</p>

      <p style="margin-top: 20px;">
        <a href="mailto:payments@migslist.com?subject=Ready to Subscribe - ${encodeURIComponent(union.name)}" class="btn">Request Invoice</a>
        <a href="mailto:${SUPPORT_EMAIL}?subject=Question about subscription" class="btn btn-outline" style="margin-left: 8px;">I Have Questions</a>
      </p>
    </div>
    <div class="footer">
      <p><strong>MIGS List</strong> - Member Management for Unions<br>
      <a href="${APP_URL}" style="color: #2563eb;">migslist.com</a> | <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb;">${SUPPORT_EMAIL}</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

async function sendTestEmails() {
  console.log('Sending test emails to trialending@migslist.com...');

  // Send 15-day email
  await transporter.sendMail({
    from: `"MIGS List" <${process.env.SMTP_FROM}>`,
    to: 'trialending@migslist.com',
    subject: '[TEST] 15-Day Reminder: How\'s your MIGS List trial going?',
    html: get15DayEmailHtml(union15)
  });
  console.log('✓ Sent 15-day test email');

  // Send 5-day email
  await transporter.sendMail({
    from: `"MIGS List" <${process.env.SMTP_FROM}>`,
    to: 'trialending@migslist.com',
    subject: '[TEST] 5-Day Reminder: Your MIGS List trial ends soon!',
    html: get5DayEmailHtml(union5)
  });
  console.log('✓ Sent 5-day test email');

  console.log('Done! Check trialending@migslist.com');
}

sendTestEmails()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e); process.exit(1); });
