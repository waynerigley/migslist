#!/usr/bin/env node
/**
 * Monthly Reminders Script
 * Run this on the 1st of each month via cron
 *
 * Cron entry (already set up - runs at 9am Toronto time on the 1st):
 * 0 9 1 * * /path/to/node /home/wayne/migs/src/scripts/monthly-reminders.js >> /home/wayne/migs/logs/reminders.log 2>&1
 *
 * Test manually: node src/scripts/monthly-reminders.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const nodemailer = require('nodemailer');

// Admin email (you)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wayne@migslist.com';

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

// Get last month's name
function getLastMonthName() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return lastMonth.toLocaleString('en-CA', { month: 'long', year: 'numeric' });
}

// Get current month name
function getCurrentMonthName() {
  const now = new Date();
  return now.toLocaleString('en-CA', { month: 'long', year: 'numeric' });
}

async function sendMonthlyReminder() {
  if (!transporter) {
    console.error('Email not configured - SMTP_HOST not set');
    process.exit(1);
  }

  const lastMonth = getLastMonthName();
  const currentMonth = getCurrentMonthName();
  const appUrl = process.env.APP_URL || 'https://migslist.com';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; }
    .task { background: white; padding: 16px; margin: 12px 0; border-radius: 8px; border-left: 4px solid #007bfc; }
    .task h3 { margin: 0 0 8px 0; color: #1f2937; }
    .task p { margin: 0; color: #6b7280; font-size: 14px; }
    .btn { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 8px 4px 0 0; }
    .btn-outline { background: white; color: #374151; border: 1px solid #d1d5db; }
    .footer { text-align: center; padding: 16px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Monthly Expense Reminder</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${currentMonth}</p>
    </div>
    <div class="content">
      <p>Hi Wayne,</p>
      <p>This is your monthly reminder to log recurring expenses for <strong>${lastMonth}</strong>.</p>

      <div class="task">
        <h3>Log Vultr Server Expense</h3>
        <p>Check your Vultr billing for last month's server hosting charges and log the expense.</p>
        <a href="https://my.vultr.com/billing/" class="btn btn-outline">View Vultr Billing</a>
        <a href="${appUrl}/admin/finance/expenses/new?vendor=Vultr&category=server" class="btn">Log Expense</a>
      </div>

      <p style="margin-top: 24px;">
        <a href="${appUrl}/admin/finance" class="btn">Go to Finance Dashboard</a>
      </p>
    </div>
    <div class="footer">
      <p>MIGS List - Member Management System<br>
      This is an automated reminder.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"MIGS List" <${process.env.SMTP_FROM}>`,
      to: ADMIN_EMAIL,
      subject: `Monthly Reminder: Log ${lastMonth} Expenses`,
      html
    });
    console.log(`[${new Date().toISOString()}] Monthly reminder sent to ${ADMIN_EMAIL}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to send reminder:`, error);
    process.exit(1);
  }
}

// Run the script
sendMonthlyReminder().then(() => {
  process.exit(0);
});
