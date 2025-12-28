const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireSuperAdmin } = require('../middleware/auth');
const Union = require('../models/Union');
const User = require('../models/User');
const Bucket = require('../models/Bucket');
const Member = require('../models/Member');
const SignupRequest = require('../models/SignupRequest');
const sgMail = require('@sendgrid/mail');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/pdfs'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Apply super admin middleware to all routes
router.use(requireSuperAdmin);

// Admin dashboard
router.get('/', async (req, res) => {
  try {
    const unions = await Union.findAll();
    const users = await User.findAll();
    const pendingSignups = await SignupRequest.findPending();
    const pendingUnions = await Union.findPending();
    const trials = await Union.findTrials();

    const stats = {
      totalUnions: unions.filter(u => u.status === 'active').length,
      totalUsers: users.length,
      totalBuckets: unions.reduce((sum, u) => sum + parseInt(u.bucket_count || 0), 0),
      totalMembers: unions.reduce((sum, u) => sum + parseInt(u.member_count || 0), 0),
      pendingSignups: pendingSignups.length,
      pendingPayments: pendingUnions.length,
      totalTrials: trials.length
    };

    res.render('admin/dashboard', { unions, users, stats, pendingSignups, pendingUnions, trials });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    req.session.error = 'Error loading dashboard';
    res.render('admin/dashboard', { unions: [], users: [], stats: {}, pendingSignups: [], pendingUnions: [], trials: [] });
  }
});

// === UNIONS ===

// List unions
router.get('/unions', async (req, res) => {
  try {
    const unions = await Union.findAll();
    res.render('admin/unions/list', { unions });
  } catch (err) {
    console.error('List unions error:', err);
    req.session.error = 'Error loading unions';
    res.render('admin/unions/list', { unions: [] });
  }
});

// New union form
router.get('/unions/new', (req, res) => {
  res.render('admin/unions/edit', { union: null });
});

// Create union
router.post('/unions', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      req.session.error = 'Union name is required';
      return res.redirect('/admin/unions/new');
    }
    await Union.create({ name: name.trim() });
    req.session.success = 'Union created successfully';
    res.redirect('/admin/unions');
  } catch (err) {
    console.error('Create union error:', err);
    req.session.error = 'Error creating union';
    res.redirect('/admin/unions/new');
  }
});

// View union
router.get('/unions/:id', async (req, res) => {
  try {
    const union = await Union.findById(req.params.id);
    if (!union) {
      req.session.error = 'Union not found';
      return res.redirect('/admin/unions');
    }
    const buckets = await Bucket.findByUnionId(union.id);
    const users = await User.findByUnionId(union.id);
    const stats = await Union.getStats(union.id);
    res.render('admin/unions/view', { union, buckets, users, stats });
  } catch (err) {
    console.error('View union error:', err);
    req.session.error = 'Error loading union';
    res.redirect('/admin/unions');
  }
});

// Edit union form
router.get('/unions/:id/edit', async (req, res) => {
  try {
    const union = await Union.findById(req.params.id);
    if (!union) {
      req.session.error = 'Union not found';
      return res.redirect('/admin/unions');
    }
    res.render('admin/unions/edit', { union });
  } catch (err) {
    console.error('Edit union error:', err);
    req.session.error = 'Error loading union';
    res.redirect('/admin/unions');
  }
});

// Update union
router.post('/unions/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      req.session.error = 'Union name is required';
      return res.redirect(`/admin/unions/${req.params.id}/edit`);
    }
    await Union.update(req.params.id, { name: name.trim() });
    req.session.success = 'Union updated successfully';
    res.redirect('/admin/unions');
  } catch (err) {
    console.error('Update union error:', err);
    req.session.error = 'Error updating union';
    res.redirect(`/admin/unions/${req.params.id}/edit`);
  }
});

// Delete union
router.post('/unions/:id/delete', async (req, res) => {
  try {
    await Union.delete(req.params.id);
    req.session.success = 'Union deleted successfully';
    res.redirect('/admin/unions');
  } catch (err) {
    console.error('Delete union error:', err);
    req.session.error = 'Error deleting union';
    res.redirect('/admin/unions');
  }
});

// === USERS ===

// List users
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll();
    const unions = await Union.findAll();
    res.render('admin/users/list', { users, unions });
  } catch (err) {
    console.error('List users error:', err);
    req.session.error = 'Error loading users';
    res.render('admin/users/list', { users: [], unions: [] });
  }
});

// New user form
router.get('/users/new', async (req, res) => {
  try {
    const unions = await Union.findAll();
    res.render('admin/users/edit', { user: null, unions });
  } catch (err) {
    console.error('New user form error:', err);
    req.session.error = 'Error loading form';
    res.redirect('/admin/users');
  }
});

// Create user
router.post('/users', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, unionId } = req.body;

    if (!email || !password) {
      req.session.error = 'Email and password are required';
      return res.redirect('/admin/users/new');
    }

    if (password.length < 8) {
      req.session.error = 'Password must be at least 8 characters';
      return res.redirect('/admin/users/new');
    }

    if (role === 'union_admin' && !unionId) {
      req.session.error = 'Union admin must be assigned to a union';
      return res.redirect('/admin/users/new');
    }

    await User.create({
      email,
      password,
      firstName,
      lastName,
      role,
      unionId: role === 'super_admin' ? null : unionId
    });

    req.session.success = 'User created successfully';
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Create user error:', err);
    if (err.code === '23505') {
      req.session.error = 'Email already exists';
    } else {
      req.session.error = 'Error creating user';
    }
    res.redirect('/admin/users/new');
  }
});

// Edit user form
router.get('/users/:id/edit', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.session.error = 'User not found';
      return res.redirect('/admin/users');
    }
    const unions = await Union.findAll();
    res.render('admin/users/edit', { user, unions });
  } catch (err) {
    console.error('Edit user error:', err);
    req.session.error = 'Error loading user';
    res.redirect('/admin/users');
  }
});

// Update user
router.post('/users/:id', async (req, res) => {
  try {
    const { email, firstName, lastName, unionId } = req.body;

    if (!email) {
      req.session.error = 'Email is required';
      return res.redirect(`/admin/users/${req.params.id}/edit`);
    }

    await User.update(req.params.id, {
      email,
      firstName,
      lastName,
      unionId: unionId || null
    });

    req.session.success = 'User updated successfully';
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Update user error:', err);
    if (err.code === '23505') {
      req.session.error = 'Email already exists';
    } else {
      req.session.error = 'Error updating user';
    }
    res.redirect(`/admin/users/${req.params.id}/edit`);
  }
});

// Reset user password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      req.session.error = 'Password must be at least 8 characters';
      return res.redirect(`/admin/users/${req.params.id}/edit`);
    }
    await User.updatePassword(req.params.id, password);
    req.session.success = 'Password reset successfully';
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Reset password error:', err);
    req.session.error = 'Error resetting password';
    res.redirect('/admin/users');
  }
});

// Delete user
router.post('/users/:id/delete', async (req, res) => {
  try {
    if (req.params.id === req.session.userId) {
      req.session.error = 'Cannot delete your own account';
      return res.redirect('/admin/users');
    }
    await User.delete(req.params.id);
    req.session.success = 'User deleted successfully';
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Delete user error:', err);
    req.session.error = 'Error deleting user';
    res.redirect('/admin/users');
  }
});

// === SIGNUP REQUESTS ===

// List signup requests
router.get('/signups', async (req, res) => {
  try {
    const signups = await SignupRequest.findAll();
    res.render('admin/signups/list', { signups });
  } catch (err) {
    console.error('List signups error:', err);
    req.session.error = 'Error loading signup requests';
    res.render('admin/signups/list', { signups: [] });
  }
});

// View signup request
router.get('/signups/:id', async (req, res) => {
  try {
    const signup = await SignupRequest.findById(req.params.id);
    if (!signup) {
      req.session.error = 'Signup request not found';
      return res.redirect('/admin/signups');
    }
    res.render('admin/signups/view', { signup });
  } catch (err) {
    console.error('View signup error:', err);
    req.session.error = 'Error loading signup request';
    res.redirect('/admin/signups');
  }
});

// Approve signup request - creates union and admin user
router.post('/signups/:id/approve', async (req, res) => {
  try {
    const { payment_reference } = req.body;
    const signup = await SignupRequest.findById(req.params.id);

    if (!signup) {
      req.session.error = 'Signup request not found';
      return res.redirect('/admin/signups');
    }

    // Create the union
    const union = await Union.create({
      name: signup.union_name,
      contactEmail: signup.contact_email,
      contactName: signup.contact_name,
      contactPhone: signup.contact_phone,
      status: 'pending',
      paymentStatus: 'unpaid'
    });

    // Activate the union with payment info
    await Union.activate(union.id, payment_reference || 'e-Transfer');

    // Generate random password
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Create the admin user
    const adminUser = await User.create({
      email: signup.admin_email,
      password: tempPassword,
      firstName: signup.admin_first_name,
      lastName: signup.admin_last_name,
      role: 'union_admin',
      unionId: union.id
    });

    // Mark signup as approved
    await SignupRequest.approve(req.params.id);

    // Send welcome email with credentials
    if (process.env.SENDGRID_API_KEY) {
      await sgMail.send({
        to: signup.admin_email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: 'Welcome to MigsList - Your Account is Ready!',
        html: `
          <h2>Welcome to MigsList!</h2>
          <p>Your union account has been activated. Here are your login credentials:</p>
          <p><strong>Login URL:</strong> ${process.env.APP_URL}/login</p>
          <p><strong>Email:</strong> ${signup.admin_email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p>Please log in and change your password immediately.</p>
          <h3>Your Subscription</h3>
          <p><strong>Union:</strong> ${signup.union_name}</p>
          <p><strong>Valid Until:</strong> ${new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString()}</p>
          <p>If you have any questions, please contact us at waynerigley@gmail.com</p>
        `
      });
    }

    req.session.success = `Union "${signup.union_name}" activated! Credentials sent to ${signup.admin_email}. Temp password: ${tempPassword}`;
    res.redirect('/admin/signups');
  } catch (err) {
    console.error('Approve signup error:', err);
    if (err.code === '23505') {
      req.session.error = 'Admin email already exists in the system';
    } else {
      req.session.error = 'Error approving signup request';
    }
    res.redirect(`/admin/signups/${req.params.id}`);
  }
});

// Reject signup request
router.post('/signups/:id/reject', async (req, res) => {
  try {
    const { notes } = req.body;
    await SignupRequest.reject(req.params.id, notes);
    req.session.success = 'Signup request rejected';
    res.redirect('/admin/signups');
  } catch (err) {
    console.error('Reject signup error:', err);
    req.session.error = 'Error rejecting signup request';
    res.redirect('/admin/signups');
  }
});

// Delete signup request
router.post('/signups/:id/delete', async (req, res) => {
  try {
    await SignupRequest.delete(req.params.id);
    req.session.success = 'Signup request deleted';
    res.redirect('/admin/signups');
  } catch (err) {
    console.error('Delete signup error:', err);
    req.session.error = 'Error deleting signup request';
    res.redirect('/admin/signups');
  }
});

// === UNION ACTIVATION ===

// Activate a pending union
router.post('/unions/:id/activate', async (req, res) => {
  try {
    const { payment_reference } = req.body;
    await Union.activate(req.params.id, payment_reference || 'Manual');
    req.session.success = 'Union activated successfully';
    res.redirect(`/admin/unions/${req.params.id}`);
  } catch (err) {
    console.error('Activate union error:', err);
    req.session.error = 'Error activating union';
    res.redirect(`/admin/unions/${req.params.id}`);
  }
});

// Deactivate a union
router.post('/unions/:id/deactivate', async (req, res) => {
  try {
    await Union.deactivate(req.params.id);
    req.session.success = 'Union deactivated';
    res.redirect(`/admin/unions/${req.params.id}`);
  } catch (err) {
    console.error('Deactivate union error:', err);
    req.session.error = 'Error deactivating union';
    res.redirect(`/admin/unions/${req.params.id}`);
  }
});

// Extend subscription
router.post('/unions/:id/extend', async (req, res) => {
  try {
    const { days } = req.body;
    const daysNum = parseInt(days) || 30;
    await Union.extendSubscription(req.params.id, daysNum);
    req.session.success = `Subscription extended by ${daysNum} days`;
    res.redirect(`/admin/unions/${req.params.id}`);
  } catch (err) {
    console.error('Extend subscription error:', err);
    req.session.error = 'Error extending subscription';
    res.redirect(`/admin/unions/${req.params.id}`);
  }
});

// Grant free year
router.post('/unions/:id/grant-free-year', async (req, res) => {
  try {
    await Union.grantFreeYear(req.params.id);
    req.session.success = 'Free year granted successfully';
    res.redirect(`/admin/unions/${req.params.id}`);
  } catch (err) {
    console.error('Grant free year error:', err);
    req.session.error = 'Error granting free year';
    res.redirect(`/admin/unions/${req.params.id}`);
  }
});

// === TRIALS ===

// List trial unions
router.get('/trials', async (req, res) => {
  try {
    const trials = await Union.findTrials();
    res.render('admin/trials/list', { trials });
  } catch (err) {
    console.error('List trials error:', err);
    req.session.error = 'Error loading trial unions';
    res.render('admin/trials/list', { trials: [] });
  }
});

// === BUCKETS (for super admin) ===

// New bucket form for a union
router.get('/unions/:unionId/buckets/new', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    if (!union) {
      req.session.error = 'Union not found';
      return res.redirect('/admin/unions');
    }
    res.render('admin/buckets/edit', { union, bucket: null });
  } catch (err) {
    console.error('New bucket form error:', err);
    req.session.error = 'Error loading form';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  }
});

// Create bucket for a union
router.post('/unions/:unionId/buckets', async (req, res) => {
  try {
    const { number, name } = req.body;
    const unionId = req.params.unionId;

    if (!number || !name) {
      req.session.error = 'Bucket number and name are required';
      return res.redirect(`/admin/unions/${unionId}/buckets/new`);
    }

    await Bucket.create({ unionId, number: number.trim(), name: name.trim() });
    req.session.success = 'Bucket created successfully';
    res.redirect(`/admin/unions/${unionId}`);
  } catch (err) {
    console.error('Create bucket error:', err);
    if (err.code === '23505') {
      req.session.error = 'A bucket with this number already exists';
    } else {
      req.session.error = 'Error creating bucket';
    }
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/new`);
  }
});

// Edit bucket form
router.get('/unions/:unionId/buckets/:id/edit', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    const bucket = await Bucket.findById(req.params.id);
    if (!union || !bucket) {
      req.session.error = 'Union or bucket not found';
      return res.redirect('/admin/unions');
    }
    res.render('admin/buckets/edit', { union, bucket });
  } catch (err) {
    console.error('Edit bucket form error:', err);
    req.session.error = 'Error loading form';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  }
});

// Update bucket
router.post('/unions/:unionId/buckets/:id', async (req, res) => {
  try {
    const { number, name } = req.body;

    if (!number || !name) {
      req.session.error = 'Bucket number and name are required';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}/edit`);
    }

    await Bucket.update(req.params.id, { number: number.trim(), name: name.trim() });
    req.session.success = 'Bucket updated successfully';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  } catch (err) {
    console.error('Update bucket error:', err);
    if (err.code === '23505') {
      req.session.error = 'A bucket with this number already exists';
    } else {
      req.session.error = 'Error updating bucket';
    }
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}/edit`);
  }
});

// Delete bucket
router.post('/unions/:unionId/buckets/:id/delete', async (req, res) => {
  try {
    await Bucket.delete(req.params.id);
    req.session.success = 'Bucket deleted successfully';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  } catch (err) {
    console.error('Delete bucket error:', err);
    req.session.error = 'Error deleting bucket';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  }
});

// View bucket with members
router.get('/unions/:unionId/buckets/:id', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    const bucket = await Bucket.findById(req.params.id);
    if (!union || !bucket) {
      req.session.error = 'Union or bucket not found';
      return res.redirect('/admin/unions');
    }
    const members = await Member.findByBucketId(req.params.id);
    res.render('admin/buckets/view', { union, bucket, members });
  } catch (err) {
    console.error('View bucket error:', err);
    req.session.error = 'Error loading bucket';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  }
});

// === MEMBERS (for super admin) ===

// New member form
router.get('/unions/:unionId/buckets/:bucketId/members/new', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    const bucket = await Bucket.findById(req.params.bucketId);
    if (!union || !bucket) {
      req.session.error = 'Union or bucket not found';
      return res.redirect('/admin/unions');
    }
    res.render('admin/members/edit', { union, bucket, member: null });
  } catch (err) {
    console.error('New member form error:', err);
    req.session.error = 'Error loading form';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}`);
  }
});

// Create member (with optional PDF)
router.post('/unions/:unionId/buckets/:bucketId/members', upload.single('pdf'), async (req, res) => {
  try {
    const {
      first_name, last_name, email, phone,
      address_line1, address_line2, city, state, zip
    } = req.body;

    if (!first_name || !last_name) {
      req.session.error = 'First name and last name are required';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/new`);
    }

    const member = await Member.create({
      bucketId: req.params.bucketId,
      firstName: first_name.trim(),
      lastName: last_name.trim(),
      email: email?.trim(),
      phone: phone?.trim(),
      addressLine1: address_line1?.trim(),
      addressLine2: address_line2?.trim(),
      city: city?.trim(),
      state: state?.trim(),
      zip: zip?.trim()
    });

    // If PDF was uploaded, attach it to the member
    if (req.file) {
      await Member.updatePdf(member.id, req.file.filename);
    }

    req.session.success = 'Member added successfully';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}`);
  } catch (err) {
    console.error('Create member error:', err);
    req.session.error = 'Error adding member';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/new`);
  }
});

// View member
router.get('/unions/:unionId/buckets/:bucketId/members/:id', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    const bucket = await Bucket.findById(req.params.bucketId);
    const member = await Member.findById(req.params.id);
    if (!union || !bucket || !member) {
      req.session.error = 'Not found';
      return res.redirect('/admin/unions');
    }
    res.render('admin/members/view', { union, bucket, member });
  } catch (err) {
    console.error('View member error:', err);
    req.session.error = 'Error loading member';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}`);
  }
});

// Edit member form
router.get('/unions/:unionId/buckets/:bucketId/members/:id/edit', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    const bucket = await Bucket.findById(req.params.bucketId);
    const member = await Member.findById(req.params.id);
    if (!union || !bucket || !member) {
      req.session.error = 'Not found';
      return res.redirect('/admin/unions');
    }
    res.render('admin/members/edit', { union, bucket, member });
  } catch (err) {
    console.error('Edit member form error:', err);
    req.session.error = 'Error loading form';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}`);
  }
});

// Update member
router.post('/unions/:unionId/buckets/:bucketId/members/:id', async (req, res) => {
  try {
    const {
      first_name, last_name, email, phone,
      address_line1, address_line2, city, state, zip
    } = req.body;

    if (!first_name || !last_name) {
      req.session.error = 'First name and last name are required';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}/edit`);
    }

    await Member.update(req.params.id, {
      firstName: first_name.trim(),
      lastName: last_name.trim(),
      email: email?.trim(),
      phone: phone?.trim(),
      addressLine1: address_line1?.trim(),
      addressLine2: address_line2?.trim(),
      city: city?.trim(),
      state: state?.trim(),
      zip: zip?.trim()
    });

    req.session.success = 'Member updated successfully';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}`);
  } catch (err) {
    console.error('Update member error:', err);
    req.session.error = 'Error updating member';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}/edit`);
  }
});

// Upload PDF
router.post('/unions/:unionId/buckets/:bucketId/members/:id/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      req.session.error = 'Member not found';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}`);
    }

    if (!req.file) {
      req.session.error = 'Please select a PDF file';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}`);
    }

    // Delete old PDF if exists
    if (member.pdf_filename) {
      const oldPath = path.join(__dirname, '../../uploads/pdfs', member.pdf_filename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await Member.updatePdf(req.params.id, req.file.filename);
    req.session.success = 'PDF uploaded successfully';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}`);
  } catch (err) {
    console.error('Upload PDF error:', err);
    req.session.error = 'Error uploading PDF';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}`);
  }
});

// Download PDF
router.get('/unions/:unionId/buckets/:bucketId/members/:id/pdf', async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member || !member.pdf_filename) {
      req.session.error = 'No PDF on file';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}`);
    }

    const filePath = path.join(__dirname, '../../uploads/pdfs', member.pdf_filename);
    if (!fs.existsSync(filePath)) {
      req.session.error = 'PDF file not found';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}`);
    }

    const downloadName = `${member.last_name}_${member.first_name}_document.pdf`;
    res.download(filePath, downloadName);
  } catch (err) {
    console.error('Download PDF error:', err);
    req.session.error = 'Error downloading PDF';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}`);
  }
});

// Remove PDF
router.post('/unions/:unionId/buckets/:bucketId/members/:id/remove-pdf', async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (member && member.pdf_filename) {
      const filePath = path.join(__dirname, '../../uploads/pdfs', member.pdf_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await Member.removePdf(req.params.id);
    }
    req.session.success = 'PDF removed successfully';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}`);
  } catch (err) {
    console.error('Remove PDF error:', err);
    req.session.error = 'Error removing PDF';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}/members/${req.params.id}`);
  }
});

// Delete member
router.post('/unions/:unionId/buckets/:bucketId/members/:id/delete', async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (member && member.pdf_filename) {
      const filePath = path.join(__dirname, '../../uploads/pdfs', member.pdf_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await Member.delete(req.params.id);
    req.session.success = 'Member deleted successfully';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}`);
  } catch (err) {
    console.error('Delete member error:', err);
    req.session.error = 'Error deleting member';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.bucketId}`);
  }
});

module.exports = router;
