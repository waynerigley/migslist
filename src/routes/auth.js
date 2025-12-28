const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { guestOnly, requireAuth } = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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

    if (result && process.env.SENDGRID_API_KEY) {
      const resetUrl = `${process.env.APP_URL}/reset-password/${result.token}`;

      await sgMail.send({
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: 'MigsList Password Reset',
        text: `Reset your password by clicking: ${resetUrl}\n\nThis link expires in 1 hour.`,
        html: `
          <h2>Password Reset</h2>
          <p>Click the link below to reset your password:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
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
