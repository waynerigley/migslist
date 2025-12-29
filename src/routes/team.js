const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireUnionPresident } = require('../middleware/auth');
const User = require('../models/User');
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Only presidents can manage team
router.use(requireUnionPresident);

// Professional email template
function getWelcomeEmailHtml(recipientName, unionName, setupUrl, presidentName, appUrl) {
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
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">MIGS List</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Member Management System</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a2e; margin: 0 0 20px; font-size: 24px;">Welcome, ${recipientName}!</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                You've been added as a <strong>Recording Secretary</strong> for <strong>${unionName}</strong>.
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                To get started, please set up your password by clicking the button below:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${setupUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">Set Up My Password</a>
                  </td>
                </tr>
              </table>
              
              <!-- What You Can Do Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="color: #0369a1; margin: 0 0 15px; font-size: 16px;">As a Recording Secretary, you can:</h3>
                    <ul style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.8;">
                      <li>Create and manage buckets</li>
                      <li>Add and edit member information</li>
                      <li>Upload signed PDF documents</li>
                      <li>Export member lists to Excel</li>
                      <li>Email documents to members</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <!-- Link expires notice -->
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Note:</strong> This setup link expires in 1 hour. If it expires, contact your President to generate a new one.
              </p>
              
              <!-- Manual link -->
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${setupUrl}" style="color: #2563eb; word-break: break-all;">${setupUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px;">
                Sent by <strong>${presidentName}</strong> on behalf of ${unionName}
              </p>
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

// List team members
router.get('/', async (req, res) => {
  try {
    const unionId = req.session.unionId;
    if (!unionId) {
      req.session.error = 'No union context';
      return res.redirect('/dashboard');
    }

    const users = await User.findByUnionId(unionId);
    
    // Separate president and secretaries
    const president = users.find(u => u.role === 'union_president' || u.role === 'union_admin');
    const secretaries = users.filter(u => u.role === 'union_secretary');
    
    // Get setup link from session and clear it
    const setupLink = req.session.setupLink;
    const setupEmail = req.session.setupEmail;
    const setupName = req.session.setupName;
    const emailSent = req.session.emailSent;
    delete req.session.setupLink;
    delete req.session.setupEmail;
    delete req.session.setupName;
    delete req.session.emailSent;
    
    res.render('team/list', { 
      users, 
      president, 
      secretaries,
      setupLink,
      setupEmail,
      setupName,
      emailSent,
      appUrl: process.env.APP_URL || 'https://migslist.com'
    });
  } catch (err) {
    console.error('List team error:', err);
    req.session.error = 'Error loading team';
    res.redirect('/dashboard');
  }
});

// Add secretary form
router.get('/add', (req, res) => {
  res.render('team/add');
});

// Create secretary
router.post('/', async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;
    const unionId = req.session.unionId;

    if (!unionId) {
      req.session.error = 'No union context';
      return res.redirect('/dashboard');
    }

    if (!email) {
      req.session.error = 'Email is required';
      return res.redirect('/team/add');
    }

    // Check if email already exists
    const existing = await User.findByEmail(email);
    if (existing) {
      req.session.error = 'A user with this email already exists';
      return res.redirect('/team/add');
    }

    // Generate random temporary password (they will reset it)
    const tempPassword = crypto.randomBytes(16).toString('hex');

    // Create the secretary
    const newUser = await User.create({
      email,
      password: tempPassword,
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      role: 'union_secretary',
      unionId
    });

    // Generate password setup token
    const result = await User.generateResetToken(email);
    const setupUrl = `${process.env.APP_URL || 'https://migslist.com'}/reset-password/${result.token}`;

    req.session.success = `Recording Secretary added!`;
    req.session.setupLink = setupUrl;
    req.session.setupEmail = email;
    req.session.setupName = firstName ? `${firstName} ${lastName || ''}`.trim() : email;

    res.redirect('/team');
  } catch (err) {
    console.error('Create secretary error:', err);
    if (err.code === '23505') {
      req.session.error = 'A user with this email already exists';
    } else {
      req.session.error = 'Error creating Recording Secretary';
    }
    res.redirect('/team/add');
  }
});

// Generate new setup link for existing secretary
router.post('/:id/setup-link', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.session.error = 'User not found';
      return res.redirect('/team');
    }

    // Can only generate for users in your union
    if (user.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/team');
    }

    // Generate new password setup token
    const result = await User.generateResetToken(user.email);
    const setupUrl = `${process.env.APP_URL || 'https://migslist.com'}/reset-password/${result.token}`;

    req.session.success = `Setup link generated!`;
    req.session.setupLink = setupUrl;
    req.session.setupEmail = user.email;
    req.session.setupName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email;

    res.redirect('/team');
  } catch (err) {
    console.error('Generate setup link error:', err);
    req.session.error = 'Error generating setup link';
    res.redirect('/team');
  }
});

// Send setup email
router.post('/:id/send-email', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.session.error = 'User not found';
      return res.redirect('/team');
    }

    // Can only send for users in your union
    if (user.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/team');
    }

    if (!process.env.SENDGRID_API_KEY) {
      req.session.error = 'Email service not configured. Please copy the link manually.';
      return res.redirect('/team');
    }

    // Generate new password setup token
    const result = await User.generateResetToken(user.email);
    const setupUrl = `${process.env.APP_URL || 'https://migslist.com'}/reset-password/${result.token}`;
    const appUrl = process.env.APP_URL || 'https://migslist.com';
    
    const recipientName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Team Member';
    const presidentName = req.session.firstName ? `${req.session.firstName} ${req.session.lastName || ''}`.trim() : 'Your President';

    await sgMail.send({
      to: user.email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: `Welcome to MIGS List - Set Up Your Account for ${req.session.unionName}`,
      html: getWelcomeEmailHtml(recipientName, req.session.unionName, setupUrl, presidentName, appUrl)
    });

    req.session.success = `Welcome email sent to ${user.email}!`;
    req.session.emailSent = true;
    res.redirect('/team');
  } catch (err) {
    console.error('Send email error:', err);
    req.session.error = 'Error sending email. Please try again or copy the link manually.';
    res.redirect('/team');
  }
});

// Remove secretary
router.post('/:id/remove', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.session.error = 'User not found';
      return res.redirect('/team');
    }

    // Can only remove secretaries from your own union
    if (user.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/team');
    }

    // Cannot remove yourself
    if (user.id === req.session.userId) {
      req.session.error = 'You cannot remove yourself';
      return res.redirect('/team');
    }

    // Can only remove secretaries (not other presidents)
    if (user.role !== 'union_secretary') {
      req.session.error = 'Can only remove Recording Secretaries';
      return res.redirect('/team');
    }

    await User.delete(req.params.id);
    req.session.success = `${user.first_name || user.email} has been removed`;
    res.redirect('/team');
  } catch (err) {
    console.error('Remove secretary error:', err);
    req.session.error = 'Error removing Recording Secretary';
    res.redirect('/team');
  }
});

module.exports = router;
