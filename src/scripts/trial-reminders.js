#!/usr/bin/env node
/**
 * Trial Reminders Script
 * Run daily via cron to send reminder emails at 15 days and 5 days before trial ends
 *
 * Cron entry (runs at 9am Toronto time daily):
 * 0 9 * * * /home/wayne/.nvm/versions/node/v24.12.0/bin/node /var/www/migs/src/scripts/trial-reminders.js >> /var/www/migs/logs/trial-reminders.log 2>&1
 *
 * Test manually: node src/scripts/trial-reminders.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Email configuration
const TRIAL_ENDING_EMAIL = 'trialending@migslist.com';
const SUPPORT_EMAIL = 'support@migslist.com';
const APP_URL = process.env.APP_URL || 'https://migslist.com';

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

// Get unions needing 15-day reminder
async function getUnionsNeeding15DayReminder() {
  const result = await pool.query(`
    SELECT u.*,
           GREATEST(0, EXTRACT(DAY FROM subscription_end - NOW())) as days_remaining
    FROM unions u
    WHERE u.payment_status = 'trial'
      AND u.subscription_end IS NOT NULL
      AND u.trial_reminder_15_sent_at IS NULL
      AND EXTRACT(DAY FROM subscription_end - NOW()) <= 15
      AND EXTRACT(DAY FROM subscription_end - NOW()) > 5
  `);
  return result.rows;
}

// Get unions needing 5-day reminder
async function getUnionsNeeding5DayReminder() {
  const result = await pool.query(`
    SELECT u.*,
           GREATEST(0, EXTRACT(DAY FROM subscription_end - NOW())) as days_remaining
    FROM unions u
    WHERE u.payment_status = 'trial'
      AND u.subscription_end IS NOT NULL
      AND u.trial_reminder_5_sent_at IS NULL
      AND EXTRACT(DAY FROM subscription_end - NOW()) <= 5
      AND EXTRACT(DAY FROM subscription_end - NOW()) >= 0
  `);
  return result.rows;
}

// Get all users for a union (president + secretaries)
async function getUnionUsers(unionId) {
  const result = await pool.query(`
    SELECT email, first_name, last_name, role
    FROM users
    WHERE union_id = $1
      AND role IN ('union_president', 'union_admin', 'union_secretary')
  `, [unionId]);
  return result.rows;
}

// Mark 15-day reminder as sent
async function mark15DayReminderSent(unionId) {
  await pool.query(
    'UPDATE unions SET trial_reminder_15_sent_at = NOW() WHERE id = $1',
    [unionId]
  );
}

// Mark 5-day reminder as sent
async function mark5DayReminderSent(unionId) {
  await pool.query(
    'UPDATE unions SET trial_reminder_5_sent_at = NOW() WHERE id = $1',
    [unionId]
  );
}

// 15-day reminder email (soft check-in)
function get15DayEmailHtml(union, daysLeft) {
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
      <span class="badge">${Math.round(daysLeft)} days remaining</span>
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

      <p>Your trial ends on <strong>${new Date(union.subscription_end).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>. We're here to help you get the most out of your trial!</p>

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

// 5-day reminder email (urgent, payment focused)
function get5DayEmailHtml(union, daysLeft) {
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
      <span class="badge">Only ${Math.round(daysLeft)} days left</span>
    </div>
    <div class="content">
      <h2>Don't Lose Access to Your Data</h2>
      <p>We hope you've enjoyed using MIGS List for <strong>${union.name}</strong>!</p>

      <p>Your free trial ends on <strong>${new Date(union.subscription_end).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>. To keep your account active and retain all your member data, you'll need to subscribe.</p>

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
        <a href="mailto:payments@migslist.com?subject=Ready to Subscribe - ${encodeURIComponent(union.name)}&body=Hi,%0A%0AI'd like to continue using MigsList.%0A%0AUnion: ${encodeURIComponent(union.name)}%0A%0APlease send me an invoice.%0A%0AThank you!" class="btn">Request Invoice</a>
        <a href="mailto:${SUPPORT_EMAIL}?subject=Question about ${encodeURIComponent(union.name)} subscription" class="btn btn-outline" style="margin-left: 8px;">I Have Questions</a>
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

async function sendReminders() {
  if (!transporter) {
    console.error(`[${new Date().toISOString()}] Email not configured - SMTP_HOST not set`);
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting trial reminder check...`);

  // Process 15-day reminders
  const unions15Day = await getUnionsNeeding15DayReminder();
  console.log(`[${new Date().toISOString()}] Found ${unions15Day.length} unions needing 15-day reminder`);

  for (const union of unions15Day) {
    try {
      const users = await getUnionUsers(union.id);
      const userEmails = users.map(u => u.email).filter(e => e);
      const allRecipients = [TRIAL_ENDING_EMAIL, ...userEmails];

      const html = get15DayEmailHtml(union, union.days_remaining);

      await transporter.sendMail({
        from: `"MIGS List" <${process.env.SMTP_FROM}>`,
        to: allRecipients.join(', '),
        subject: `How's your MIGS List trial going? (${Math.round(union.days_remaining)} days left)`,
        html
      });

      await mark15DayReminderSent(union.id);
      console.log(`[${new Date().toISOString()}] Sent 15-day reminder for ${union.name} to: ${allRecipients.join(', ')}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to send 15-day reminder for ${union.name}:`, error);
    }
  }

  // Process 5-day reminders
  const unions5Day = await getUnionsNeeding5DayReminder();
  console.log(`[${new Date().toISOString()}] Found ${unions5Day.length} unions needing 5-day reminder`);

  for (const union of unions5Day) {
    try {
      const users = await getUnionUsers(union.id);
      const userEmails = users.map(u => u.email).filter(e => e);
      const allRecipients = [TRIAL_ENDING_EMAIL, ...userEmails];

      const html = get5DayEmailHtml(union, union.days_remaining);

      await transporter.sendMail({
        from: `"MIGS List" <${process.env.SMTP_FROM}>`,
        to: allRecipients.join(', '),
        subject: `Your MIGS List trial ends in ${Math.round(union.days_remaining)} days - ${union.name}`,
        html
      });

      await mark5DayReminderSent(union.id);
      console.log(`[${new Date().toISOString()}] Sent 5-day reminder for ${union.name} to: ${allRecipients.join(', ')}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to send 5-day reminder for ${union.name}:`, error);
    }
  }

  console.log(`[${new Date().toISOString()}] Trial reminder check complete`);
}

// Run the script
sendReminders()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch(err => {
    console.error(`[${new Date().toISOString()}] Script error:`, err);
    pool.end();
    process.exit(1);
  });
