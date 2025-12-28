const express = require('express');
const router = express.Router();
const SignupRequest = require('../models/SignupRequest');

// Pricing page
router.get('/pricing', (req, res) => {
  res.render('public/pricing', { layout: false });
});

// Signup form
router.get('/signup', (req, res) => {
  res.render('public/signup', { layout: false });
});

// Handle signup submission
router.post('/signup', async (req, res) => {
  try {
    const {
      union_name, contact_name, contact_email, contact_phone,
      admin_email, admin_first_name, admin_last_name
    } = req.body;

    // Validation
    if (!union_name || !contact_name || !contact_email || !admin_email) {
      return res.render('public/signup', {
        layout: false,
        error: 'Please fill in all required fields',
        formData: req.body
      });
    }

    // Create signup request
    await SignupRequest.create({
      unionName: union_name.trim(),
      contactName: contact_name.trim(),
      contactEmail: contact_email.trim(),
      contactPhone: contact_phone?.trim(),
      adminEmail: admin_email.trim(),
      adminFirstName: admin_first_name?.trim(),
      adminLastName: admin_last_name?.trim()
    });

    res.redirect('/signup/success');
  } catch (err) {
    console.error('Signup error:', err);
    res.render('public/signup', {
      layout: false,
      error: 'An error occurred. Please try again.',
      formData: req.body
    });
  }
});

// Signup success / e-Transfer instructions
router.get('/signup/success', (req, res) => {
  res.render('public/signup-success', { layout: false });
});

module.exports = router;
