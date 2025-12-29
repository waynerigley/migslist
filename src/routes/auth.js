const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { guestOnly, requireAuth } = require('../middleware/auth');

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

// Password reset email template
function getPasswordResetEmailHtml(recipientName, resetUrl, appUrl) {
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
              <h2 style="color: #1a1a2e; margin: 0 0 20px; font-size: 24px;">Password Reset Request</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hi${recipientName ? ' ' + recipientName : ''},
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">Reset My Password</a>
                  </td>
                </tr>
              </table>
              
              <!-- Security notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #92400e; font-size: 14px; margin: 0;">
                      <strong>Security Notice:</strong> This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password will remain unchanged.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Manual link -->
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
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

// Landing page
router.get('/', (req, res) => {
  if (req.session.userId) {
    if (req.session.role === 'super_admin') {
      return res.redirect('/admin');
    }
    return res.redirect('/dashboard');
  }
  res.render('landing', { layout: false });
});

// Features page
router.get('/features', (req, res) => {
  res.render('features', { layout: false });
});

// Login page
router.get('/login', guestOnly, (req, res) => {
  res.render('login', { layout: false });
});

// Login handler
router.post('/login', guestOnly, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.session.error = 'Email and password are required';
      return res.redirect('/login');
    }

    const user = await User.findByEmail(email);
    if (!user) {
      req.session.error = 'Invalid email or password';
      return res.redirect('/login');
    }

    const validPassword = await User.verifyPassword(password, user.password_hash);
    if (!validPassword) {
      req.session.error = 'Invalid email or password';
      return res.redirect('/login');
    }

    // Set session
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.firstName = user.first_name;
    req.session.lastName = user.last_name;
    req.session.role = user.role;
    req.session.unionId = user.union_id;
    req.session.unionName = user.union_name;

    if (user.role === 'super_admin') {
      return res.redirect('/admin');
    }
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    req.session.error = 'An error occurred. Please try again.';
    res.redirect('/login');
  }
});

// Logout
router.get('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// Forgot password page
router.get('/forgot-password', guestOnly, (req, res) => {
  res.render('forgot-password', { layout: false });
});

// Forgot password handler
router.post('/forgot-password', guestOnly, async (req, res) => {
  try {
    const { email } = req.body;

    const result = await User.generateResetToken(email);

    // Always show success message (don't reveal if email exists)
    req.session.success = 'If an account exists with that email, you will receive a password reset link.';

    if (result && transporter) {
      const resetUrl = `${process.env.APP_URL || 'https://migslist.com'}/reset-password/${result.token}`;
      const appUrl = process.env.APP_URL || 'https://migslist.com';

      // Get user info for personalization
      const user = await User.findByEmail(email);
      const recipientName = user?.first_name || '';

      await transporter.sendMail({
        from: `"MIGS List" <${process.env.SMTP_FROM}>`,
        to: email,
        subject: 'MIGS List - Password Reset Request',
        html: getPasswordResetEmailHtml(recipientName, resetUrl, appUrl)
      });
    }

    res.redirect('/forgot-password');
  } catch (err) {
    console.error('Forgot password error:', err);
    req.session.error = 'An error occurred. Please try again.';
    res.redirect('/forgot-password');
  }
});

// Reset password page
router.get('/reset-password/:token', guestOnly, async (req, res) => {
  try {
    const user = await User.findByResetToken(req.params.token);
    if (!user) {
      req.session.error = 'Invalid or expired reset link';
      return res.redirect('/forgot-password');
    }
    res.render('reset-password', { layout: false, token: req.params.token });
  } catch (err) {
    console.error('Reset password error:', err);
    req.session.error = 'An error occurred. Please try again.';
    res.redirect('/forgot-password');
  }
});

// Reset password handler
router.post('/reset-password/:token', guestOnly, async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      req.session.error = 'Passwords do not match';
      return res.redirect(`/reset-password/${req.params.token}`);
    }

    if (password.length < 8) {
      req.session.error = 'Password must be at least 8 characters';
      return res.redirect(`/reset-password/${req.params.token}`);
    }

    const user = await User.findByResetToken(req.params.token);
    if (!user) {
      req.session.error = 'Invalid or expired reset link';
      return res.redirect('/forgot-password');
    }

    await User.updatePassword(user.id, password);

    req.session.success = 'Password reset successfully. Please log in.';
    res.redirect('/login');
  } catch (err) {
    console.error('Reset password error:', err);
    req.session.error = 'An error occurred. Please try again.';
    res.redirect('/forgot-password');
  }
});

module.exports = router;
