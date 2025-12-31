const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Union = require('../models/Union');
const User = require('../models/User');
const SignupRequest = require('../models/SignupRequest');

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

// President welcome email template
function getPresidentWelcomeEmailHtml(firstName, unionName, loginUrl, trialEndDate, appUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Welcome to MIGS List!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Your 30-Day Free Trial Has Started</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a2e; margin: 0 0 20px; font-size: 24px;">Hi ${firstName}!</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Thank you for signing up! Your account for <strong>${unionName}</strong> is now active and ready to use.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">Log In to Your Account</a>
                  </td>
                </tr>
              </table>
              
              <!-- Getting Started -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="color: #166534; margin: 0 0 15px; font-size: 16px;">Getting Started:</h3>
                    <ol style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.8;">
                      <li>Log in with the email and password you created</li>
                      <li>Create <strong>Buckets</strong> to organize your members (e.g., "Active Members", "Retirees")</li>
                      <li>Add your members and upload their signed documents</li>
                      <li>Go to <strong>Manage Team</strong> to add Recording Secretaries for data entry help</li>
                    </ol>
                  </td>
                </tr>
              </table>
              
              <!-- Trial info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="color: #0369a1; margin: 0 0 10px; font-size: 16px;">Your Free Trial</h3>
                    <p style="color: #4b5563; margin: 0 0 10px; font-size: 15px;">
                      <strong>Trial Ends:</strong> ${trialEndDate}
                    </p>
                    <p style="color: #4b5563; margin: 0; font-size: 15px;">
                      After your trial, continue for just <strong>$500/year CAD</strong> (first year) to keep your members organized!
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- As President section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="color: #92400e; margin: 0 0 15px; font-size: 16px;">As President, you can:</h3>
                    <ul style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.8;">
                      <li>Add Recording Secretaries to help with data entry</li>
                      <li>Create and delete Buckets</li>
                      <li>Export 1-click voter lists for elections</li>
                      <li>Full access to all member data and documents</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0;">
                Questions? Just reply to this email - we're here to help!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                <a href="${appUrl}" style="color: #2563eb;">MIGS List</a> - Union Member Management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// Pricing page
router.get('/pricing', (req, res) => {
  res.render('public/pricing', { layout: false });
});

// Signup form
router.get('/signup', (req, res) => {
  res.render('public/signup', { layout: false });
});

// Handle signup submission - creates trial immediately
router.post('/signup', async (req, res) => {
  try {
    const {
      union_name,
      admin_email, admin_password, admin_first_name, admin_last_name, admin_phone
    } = req.body;

    // Validation
    if (!union_name || !admin_email || !admin_password || !admin_first_name || !admin_last_name) {
      return res.render('public/signup', {
        layout: false,
        error: 'Please fill in all required fields',
        formData: req.body
      });
    }

    if (admin_password.length < 8) {
      return res.render('public/signup', {
        layout: false,
        error: 'Password must be at least 8 characters',
        formData: req.body
      });
    }

    // Check if admin email already exists
    const existingUser = await User.findByEmail(admin_email.trim());
    if (existingUser) {
      return res.render('public/signup', {
        layout: false,
        error: 'An account with this email already exists',
        formData: req.body
      });
    }

    // Create the union (use President info as contact)
    const union = await Union.create({
      name: union_name.trim(),
      contactEmail: admin_email.trim(),
      contactName: (admin_first_name + ' ' + admin_last_name).trim(),
      contactPhone: admin_phone?.trim() || null,
      status: 'pending',
      paymentStatus: 'unpaid'
    });

    // Start 30-day trial
    await Union.startTrial(union.id);

    // Create the president user
    await User.create({
      email: admin_email.trim(),
      password: admin_password,
      firstName: admin_first_name?.trim(),
      lastName: admin_last_name?.trim(),
      role: 'union_president',
      unionId: union.id
    });

    // Also log it as a signup request for admin tracking
    await SignupRequest.create({
      unionName: union_name.trim(),
      contactName: (admin_first_name + ' ' + admin_last_name).trim(),
      contactEmail: admin_email.trim(),
      contactPhone: admin_phone?.trim() || null,
      adminEmail: admin_email.trim(),
      adminFirstName: admin_first_name?.trim(),
      adminLastName: admin_last_name?.trim(),
      status: 'trial'
    });

    // Send welcome email
    if (transporter) {
      try {
        const appUrl = process.env.APP_URL || 'https://migslist.com';
        const trialEndDate = new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        await transporter.sendMail({
          from: `"MIGS List" <${process.env.SMTP_FROM}>`,
          to: admin_email.trim(),
          subject: `Welcome to MIGS List - Your 30-Day Trial for ${union_name} Has Started!`,
          html: getPresidentWelcomeEmailHtml(admin_first_name, union_name, appUrl + '/login', trialEndDate, appUrl)
        });
      } catch (emailErr) {
        console.error('Welcome email error:', emailErr);
      }
    }

    res.redirect('/signup/success?trial=1');
  } catch (err) {
    console.error('Signup error:', err);
    res.render('public/signup', {
      layout: false,
      error: 'An error occurred. Please try again.',
      formData: req.body
    });
  }
});

// Signup success
router.get('/signup/success', (req, res) => {
  const isTrial = req.query.trial === '1';
  res.render('public/signup-success', { layout: false, isTrial });
});

module.exports = router;
