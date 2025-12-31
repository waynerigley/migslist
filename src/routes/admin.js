const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
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

// Create bucket for a union (with optional master PDF)
router.post('/unions/:unionId/buckets', upload.single('master_pdf'), async (req, res) => {
  try {
    const { number, name } = req.body;
    const unionId = req.params.unionId;

    if (!number || !name) {
      req.session.error = 'Bucket number and name are required';
      return res.redirect(`/admin/unions/${unionId}/buckets/new`);
    }

    const bucket = await Bucket.create({ unionId, number: number.trim(), name: name.trim() });

    // If master PDF was uploaded, attach it
    if (req.file) {
      await Bucket.updateMasterPdf(bucket.id, req.file.filename);
    }

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

// Delete bucket (soft delete)
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

// View deleted buckets
router.get('/unions/:unionId/buckets-deleted', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    if (!union) {
      req.session.error = 'Union not found';
      return res.redirect('/admin/unions');
    }
    const deletedBuckets = await Bucket.findDeleted(req.params.unionId);
    res.render('admin/buckets/deleted', { union, deletedBuckets });
  } catch (err) {
    console.error('View deleted buckets error:', err);
    req.session.error = 'Error loading deleted buckets';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  }
});

// Restore bucket
router.post('/unions/:unionId/buckets/:id/restore', async (req, res) => {
  try {
    await Bucket.restore(req.params.id);
    req.session.success = 'Bucket restored successfully';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  } catch (err) {
    console.error('Restore bucket error:', err);
    req.session.error = 'Error restoring bucket';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets-deleted`);
  }
});

// Permanently delete bucket
router.post('/unions/:unionId/buckets/:id/hard-delete', async (req, res) => {
  try {
    await Bucket.hardDelete(req.params.id);
    req.session.success = 'Bucket permanently deleted';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets-deleted`);
  } catch (err) {
    console.error('Hard delete bucket error:', err);
    req.session.error = 'Error deleting bucket';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets-deleted`);
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
    const retiredMembers = await Member.findRetiredByBucketId(req.params.id);
    res.render('admin/buckets/view', { union, bucket, members, retiredCount: retiredMembers.length });
  } catch (err) {
    console.error('View bucket error:', err);
    req.session.error = 'Error loading bucket';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  }
});

// View retired members
router.get('/unions/:unionId/buckets/:id/retired', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    const bucket = await Bucket.findById(req.params.id);
    if (!union || !bucket) {
      req.session.error = 'Union or bucket not found';
      return res.redirect('/admin/unions');
    }
    const members = await Member.findRetiredByBucketId(req.params.id);
    res.render('admin/buckets/retired', { union, bucket, members });
  } catch (err) {
    console.error('View retired members error:', err);
    req.session.error = 'Error loading retired members';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
  }
});

// Upload master PDF for bucket
router.post('/unions/:unionId/buckets/:id/upload-master-pdf', upload.single('master_pdf'), async (req, res) => {
  try {
    const bucket = await Bucket.findById(req.params.id);
    if (!bucket) {
      req.session.error = 'Bucket not found';
      return res.redirect(`/admin/unions/${req.params.unionId}`);
    }

    if (!req.file) {
      req.session.error = 'Please select a PDF file';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}/edit`);
    }

    // Delete old PDF if exists
    if (bucket.master_pdf_filename) {
      const oldPath = path.join(__dirname, '../../uploads/pdfs', bucket.master_pdf_filename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await Bucket.updateMasterPdf(req.params.id, req.file.filename);
    req.session.success = 'Master PDF uploaded successfully';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}/edit`);
  } catch (err) {
    console.error('Upload master PDF error:', err);
    req.session.error = 'Error uploading PDF';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}/edit`);
  }
});

// Download master PDF
router.get('/unions/:unionId/buckets/:id/master-pdf', async (req, res) => {
  try {
    const bucket = await Bucket.findById(req.params.id);
    if (!bucket || !bucket.master_pdf_filename) {
      req.session.error = 'No master PDF on file';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
    }

    const filePath = path.join(__dirname, '../../uploads/pdfs', bucket.master_pdf_filename);
    if (!fs.existsSync(filePath)) {
      req.session.error = 'PDF file not found';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
    }

    const downloadName = `${bucket.name.replace(/[^a-z0-9]/gi, '_')}_master.pdf`;
    res.download(filePath, downloadName);
  } catch (err) {
    console.error('Download master PDF error:', err);
    req.session.error = 'Error downloading PDF';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
  }
});

// Remove master PDF
router.post('/unions/:unionId/buckets/:id/remove-master-pdf', async (req, res) => {
  try {
    const bucket = await Bucket.findById(req.params.id);
    if (bucket && bucket.master_pdf_filename) {
      const filePath = path.join(__dirname, '../../uploads/pdfs', bucket.master_pdf_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await Bucket.removeMasterPdf(req.params.id);
    }
    req.session.success = 'Master PDF removed';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}/edit`);
  } catch (err) {
    console.error('Remove master PDF error:', err);
    req.session.error = 'Error removing PDF';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}/edit`);
  }
});

// Email member with master PDF attached
router.post('/unions/:unionId/buckets/:id/email-member/:memberId', async (req, res) => {
  try {
    const bucket = await Bucket.findById(req.params.id);
    const member = await Member.findById(req.params.memberId);

    if (!bucket || !member) {
      req.session.error = 'Bucket or member not found';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
    }

    if (!member.email) {
      req.session.error = 'Member does not have an email address';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
    }

    if (!bucket.master_pdf_filename) {
      req.session.error = 'No master PDF uploaded for this bucket';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
    }

    const pdfPath = path.join(__dirname, '../../uploads/pdfs', bucket.master_pdf_filename);
    if (!fs.existsSync(pdfPath)) {
      req.session.error = 'Master PDF file not found';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
    }

    if (!process.env.SENDGRID_API_KEY) {
      req.session.error = 'Email service not configured';
      return res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
    }

    // Read PDF and convert to base64
    const pdfContent = fs.readFileSync(pdfPath).toString('base64');

    await sgMail.send({
      to: member.email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: `Action Required: ${bucket.name} - Document Signature`,
      html: `
        <h2>Hello ${member.first_name},</h2>
        <p>Please find attached the document that requires your signature for <strong>${bucket.name}</strong>.</p>
        <p>Once signed, please return this document to your union representative.</p>
        <p>Thank you,<br>Your Union Local</p>
      `,
      attachments: [
        {
          content: pdfContent,
          filename: `${bucket.name.replace(/[^a-z0-9]/gi, '_')}_document.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    });

    req.session.success = `Email sent to ${member.first_name} ${member.last_name}`;
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
  } catch (err) {
    console.error('Email member error:', err);
    req.session.error = 'Error sending email';
    res.redirect(`/admin/unions/${req.params.unionId}/buckets/${req.params.id}`);
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

// Export all union members (Rank-and-File) to Excel - Admin
router.get('/unions/:unionId/export/rank-and-file/excel', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    if (!union) {
      req.session.error = 'Union not found';
      return res.redirect('/admin');
    }

    const members = await Member.findAllByUnionId(req.params.unionId);
    const exportDate = new Date();
    // Use Eastern Time for Canadian unions
    const formattedDate = exportDate.toLocaleDateString('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = exportDate.toLocaleTimeString('en-CA', {
      timeZone: 'America/Toronto',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MigsList';
    workbook.created = exportDate;

    const sheet = workbook.addWorksheet('Rank-and-File Members');

    // Row 1: Union Name
    sheet.mergeCells('A1:H1');
    sheet.getCell('A1').value = union.name;
    sheet.getCell('A1').font = { bold: true, size: 18 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    // Row 2: Title
    sheet.mergeCells('A2:H2');
    sheet.getCell('A2').value = 'Rank-and-File Members List';
    sheet.getCell('A2').font = { bold: false, size: 14 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    // Row 3: Export Date
    sheet.mergeCells('A3:H3');
    sheet.getCell('A3').value = `Export Date: ${formattedDate} at ${formattedTime}`;
    sheet.getCell('A3').font = { bold: true, size: 11 };
    sheet.getCell('A3').alignment = { horizontal: 'center' };

    // Row 4: Total Members
    sheet.mergeCells('A4:H4');
    sheet.getCell('A4').value = `Total Members: ${members.length}`;
    sheet.getCell('A4').font = { bold: true, size: 11 };
    sheet.getCell('A4').alignment = { horizontal: 'center' };

    // Row 5: Legal notice
    sheet.mergeCells('A5:H5');
    sheet.getCell('A5').value = 'This document is for official union use only. For Legislative Strike Vote or Ratification Vote purposes.';
    sheet.getCell('A5').font = { italic: true, size: 9 };
    sheet.getCell('A5').alignment = { horizontal: 'center' };

    // Set column widths (without headers - we'll add them manually)
    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 25;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 30;
    sheet.getColumn(7).width = 15;
    sheet.getColumn(8).width = 10;

    // Row 7: Column headers
    const headerRow = sheet.getRow(7);
    headerRow.values = ['Unit/Sectional', 'First Name', 'Last Name', 'Email', 'Phone', 'Address', 'City', 'Province'];
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add member data starting at row 8
    let rowNum = 8;
    members.forEach(member => {
      const address = [member.address_line1, member.address_line2].filter(Boolean).join(', ');
      const row = sheet.getRow(rowNum);
      row.values = [
        `#${member.bucket_number} - ${member.bucket_name}`,
        member.first_name,
        member.last_name,
        member.email || '',
        member.phone || '',
        address,
        member.city || '',
        member.state || ''
      ];
      rowNum++;
    });

    const filename = `${union.name.replace(/[^a-z0-9]/gi, '_')}_Rank_and_File_${exportDate.toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Admin export error:', err);
    req.session.error = 'Error exporting data';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  }
});

// Export all union members (Rank-and-File) to PDF - Admin
router.get('/unions/:unionId/export/rank-and-file/pdf', async (req, res) => {
  try {
    const union = await Union.findById(req.params.unionId);
    if (!union) {
      req.session.error = 'Union not found';
      return res.redirect('/admin');
    }

    const members = await Member.findAllByUnionId(req.params.unionId);
    const exportDate = new Date();
    // Use Eastern Time for Canadian unions
    const formattedDate = exportDate.toLocaleDateString('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = exportDate.toLocaleTimeString('en-CA', {
      timeZone: 'America/Toronto',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const formattedDateTime = `${formattedDate} at ${formattedTime}`;

    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 50,
      bufferPages: true
    });

    const filename = `${union.name.replace(/[^a-z0-9]/gi, '_')}_Rank_and_File_${exportDate.toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text(union.name, { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Rank-and-File Members List', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Export Date: ${formattedDateTime}`, { align: 'center' });
    doc.text(`Total Members: ${members.length}`, { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(8).font('Helvetica-Oblique');
    doc.text('This document is for official union use only. For Legislative Strike Vote or Ratification Vote purposes.', { align: 'center' });
    doc.moveDown(1);

    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 150;
    const col3 = 300;
    const col4 = 450;
    const rowHeight = 18;

    doc.rect(col1 - 5, tableTop - 5, 520, rowHeight + 5).fill('#2563eb');

    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('Unit', col1, tableTop, { width: 95 });
    doc.text('Name', col2, tableTop, { width: 145 });
    doc.text('Email', col3, tableTop, { width: 145 });
    doc.text('Phone', col4, tableTop, { width: 80 });

    doc.fillColor('black').font('Helvetica').fontSize(8);

    let y = tableTop + rowHeight + 5;
    let rowCount = 0;

    members.forEach((member) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
        doc.rect(col1 - 5, y - 5, 520, rowHeight + 5).fill('#2563eb');
        doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
        doc.text('Unit', col1, y, { width: 95 });
        doc.text('Name', col2, y, { width: 145 });
        doc.text('Email', col3, y, { width: 145 });
        doc.text('Phone', col4, y, { width: 80 });
        doc.fillColor('black').font('Helvetica').fontSize(8);
        y += rowHeight + 5;
      }

      if (rowCount % 2 === 0) {
        doc.rect(col1 - 5, y - 2, 520, rowHeight).fill('#f3f4f6');
        doc.fillColor('black');
      }

      const bucketLabel = `#${member.bucket_number}`;
      const fullName = `${member.first_name} ${member.last_name}`;

      doc.text(bucketLabel, col1, y, { width: 95, ellipsis: true });
      doc.text(fullName, col2, y, { width: 145, ellipsis: true });
      doc.text(member.email || '-', col3, y, { width: 145, ellipsis: true });
      doc.text(member.phone || '-', col4, y, { width: 80, ellipsis: true });

      y += rowHeight;
      rowCount++;
    });

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica');
      doc.text(
        `Page ${i + 1} of ${pages.count} | Generated by MIGS List | ${formattedDateTime}`,
        50,
        750,
        { align: 'center', width: 512 }
      );
    }

    doc.end();
  } catch (err) {
    console.error('Admin export error:', err);
    req.session.error = 'Error exporting data';
    res.redirect(`/admin/unions/${req.params.unionId}`);
  }
});

module.exports = router;
