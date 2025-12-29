const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Union = require('../models/Union');
const User = require('../models/User');
const SignupRequest = require('../models/SignupRequest');
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({
          to: admin_email.trim(),
          from: process.env.SENDGRID_FROM_EMAIL,
          subject: 'Welcome to MIGS List - Your 30-Day Trial Has Started!',
          html: `
            <h2>Welcome to MIGS List!</h2>
            <p>Hi ${admin_first_name},</p>
            <p>Your 30-day free trial is now active for <strong>${union_name}</strong>.</p>
            <h3>Login Details</h3>
            <p><strong>Login URL:</strong> ${process.env.APP_URL}</p>
            <p><strong>Email:</strong> ${admin_email}</p>
            <h3>Getting Started</h3>
            <ol>
              <li>Log in with the credentials you created</li>
              <li>Create buckets to organize your members</li>
              <li>Add your members and upload their signed documents</li>
              <li>Need help with data entry? Go to <strong>Team</strong> to add Recording Secretaries</li>
            </ol>
            <h3>Your Trial</h3>
            <p><strong>Trial Ends:</strong> ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</p>
            <p>After your trial, continue for just <strong>$400/year CAD</strong>.</p>
            <p>Questions? Contact us at waynerigley@gmail.com</p>
          `
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
