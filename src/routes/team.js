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

// List team members (secretaries)
router.get('/', async (req, res) => {
  try {
    const unionId = req.session.unionId;
    if (!unionId) {
      req.session.error = 'No union context';
      return res.redirect('/dashboard');
    }

    const users = await User.findByUnionId(unionId);
    res.render('team/list', { users });
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

    // Generate random password
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Create the secretary
    await User.create({
      email,
      password: tempPassword,
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      role: 'union_secretary',
      unionId
    });

    // Send welcome email with credentials
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL,
          subject: 'Welcome to MigsList - Your Secretary Account',
          html: `
            <h2>Welcome to MigsList!</h2>
            <p>You've been added as a Secretary for <strong>${req.session.unionName}</strong>.</p>
            <p>Here are your login credentials:</p>
            <p><strong>Login URL:</strong> ${process.env.APP_URL}/login</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p>Please log in and change your password immediately using the "Forgot password" link.</p>
            <p>As a Secretary, you can:</p>
            <ul>
              <li>Add and edit buckets</li>
              <li>Add and edit members</li>
              <li>Upload member PDFs</li>
              <li>Export member lists</li>
            </ul>
            <p>If you have any questions, contact your Union President.</p>
          `
        });
        req.session.success = `Secretary added! Credentials sent to ${email}`;
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
        req.session.success = `Secretary added! Temp password: ${tempPassword} (email failed to send)`;
      }
    } else {
      req.session.success = `Secretary added! Temp password: ${tempPassword}`;
    }

    res.redirect('/team');
  } catch (err) {
    console.error('Create secretary error:', err);
    if (err.code === '23505') {
      req.session.error = 'A user with this email already exists';
    } else {
      req.session.error = 'Error creating secretary';
    }
    res.redirect('/team/add');
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
      req.session.error = 'Can only remove secretaries';
      return res.redirect('/team');
    }

    await User.delete(req.params.id);
    req.session.success = `${user.first_name || user.email} has been removed`;
    res.redirect('/team');
  } catch (err) {
    console.error('Remove secretary error:', err);
    req.session.error = 'Error removing secretary';
    res.redirect('/team');
  }
});

module.exports = router;
