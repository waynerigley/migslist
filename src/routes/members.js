const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireUnionAdmin } = require('../middleware/auth');
const Bucket = require('../models/Bucket');
const Member = require('../models/Member');

router.use(requireUnionAdmin);

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

// Helper to check member access
async function checkMemberAccess(req, res, next) {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      req.session.error = 'Member not found';
      return res.redirect('/dashboard');
    }

    // Super admins can access any member
    if (req.session.role === 'super_admin') {
      req.member = member;
      return next();
    }

    // Union admins can only access their union's members
    if (member.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/dashboard');
    }

    req.member = member;
    next();
  } catch (err) {
    console.error('Member access check error:', err);
    req.session.error = 'Error accessing member';
    res.redirect('/dashboard');
  }
}

// New member form
router.get('/new', async (req, res) => {
  try {
    const { bucket_id } = req.query;
    if (!bucket_id) {
      req.session.error = 'Bucket ID required';
      return res.redirect('/dashboard');
    }

    const bucket = await Bucket.findById(bucket_id);
    if (!bucket) {
      req.session.error = 'Bucket not found';
      return res.redirect('/dashboard');
    }

    // Check bucket access
    if (req.session.role !== 'super_admin' && bucket.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/dashboard');
    }

    res.render('members/edit', { member: null, bucket });
  } catch (err) {
    console.error('New member form error:', err);
    req.session.error = 'Error loading form';
    res.redirect('/dashboard');
  }
});

// Create member (with optional PDF)
router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    const {
      bucket_id, first_name, last_name, email, phone,
      address_line1, address_line2, city, state, zip
    } = req.body;

    if (!bucket_id || !first_name || !last_name) {
      req.session.error = 'First name and last name are required';
      return res.redirect(`/members/new?bucket_id=${bucket_id}`);
    }

    // Check bucket access
    const bucket = await Bucket.findById(bucket_id);
    if (!bucket) {
      req.session.error = 'Bucket not found';
      return res.redirect('/dashboard');
    }

    if (req.session.role !== 'super_admin' && bucket.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/dashboard');
    }

    const member = await Member.create({
      bucketId: bucket_id,
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
    res.redirect(`/buckets/${bucket_id}`);
  } catch (err) {
    console.error('Create member error:', err);
    req.session.error = 'Error adding member';
    res.redirect('/dashboard');
  }
});

// View member
router.get('/:id', checkMemberAccess, (req, res) => {
  res.render('members/view', { member: req.member });
});

// Edit member form
router.get('/:id/edit', checkMemberAccess, async (req, res) => {
  const bucket = await Bucket.findById(req.member.bucket_id);
  res.render('members/edit', { member: req.member, bucket });
});

// Update member
router.post('/:id', checkMemberAccess, async (req, res) => {
  try {
    const {
      first_name, last_name, email, phone,
      address_line1, address_line2, city, state, zip
    } = req.body;

    if (!first_name || !last_name) {
      req.session.error = 'First name and last name are required';
      return res.redirect(`/members/${req.params.id}/edit`);
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
    res.redirect(`/buckets/${req.member.bucket_id}`);
  } catch (err) {
    console.error('Update member error:', err);
    req.session.error = 'Error updating member';
    res.redirect(`/members/${req.params.id}/edit`);
  }
});

// Upload PDF
router.post('/:id/upload-pdf', checkMemberAccess, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      req.session.error = 'Please select a PDF file';
      return res.redirect(`/members/${req.params.id}`);
    }

    // Delete old PDF if exists
    if (req.member.pdf_filename) {
      const oldPath = path.join(__dirname, '../../uploads/pdfs', req.member.pdf_filename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await Member.updatePdf(req.params.id, req.file.filename);
    req.session.success = 'PDF uploaded successfully';
    res.redirect(`/members/${req.params.id}`);
  } catch (err) {
    console.error('Upload PDF error:', err);
    req.session.error = 'Error uploading PDF';
    res.redirect(`/members/${req.params.id}`);
  }
});

// Download PDF
router.get('/:id/pdf', checkMemberAccess, (req, res) => {
  if (!req.member.pdf_filename) {
    req.session.error = 'No PDF on file';
    return res.redirect(`/members/${req.params.id}`);
  }

  const filePath = path.join(__dirname, '../../uploads/pdfs', req.member.pdf_filename);
  if (!fs.existsSync(filePath)) {
    req.session.error = 'PDF file not found';
    return res.redirect(`/members/${req.params.id}`);
  }

  const downloadName = `${req.member.last_name}_${req.member.first_name}_document.pdf`;
  res.download(filePath, downloadName);
});

// Remove PDF
router.post('/:id/remove-pdf', checkMemberAccess, async (req, res) => {
  try {
    if (req.member.pdf_filename) {
      const filePath = path.join(__dirname, '../../uploads/pdfs', req.member.pdf_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await Member.removePdf(req.params.id);
    }
    req.session.success = 'PDF removed successfully';
    res.redirect(`/members/${req.params.id}`);
  } catch (err) {
    console.error('Remove PDF error:', err);
    req.session.error = 'Error removing PDF';
    res.redirect(`/members/${req.params.id}`);
  }
});

// Retire member (move to retired list)
router.post('/:id/retire', checkMemberAccess, async (req, res) => {
  try {
    const { reason } = req.body;
    const bucketId = req.member.bucket_id;

    await Member.retire(req.params.id, reason || 'Retired/Left Union');
    req.session.success = `${req.member.first_name} ${req.member.last_name} has been moved to retired members`;
    res.redirect(`/buckets/${bucketId}`);
  } catch (err) {
    console.error('Retire member error:', err);
    req.session.error = 'Error retiring member';
    res.redirect(`/buckets/${req.member.bucket_id}`);
  }
});

// Restore retired member
router.post('/:id/restore', checkMemberAccess, async (req, res) => {
  try {
    const bucketId = req.member.bucket_id;

    await Member.restore(req.params.id);
    req.session.success = `${req.member.first_name} ${req.member.last_name} has been restored to active members`;
    res.redirect(`/buckets/${bucketId}/retired`);
  } catch (err) {
    console.error('Restore member error:', err);
    req.session.error = 'Error restoring member';
    res.redirect(`/buckets/${req.member.bucket_id}/retired`);
  }
});

// Delete member
router.post('/:id/delete', checkMemberAccess, async (req, res) => {
  try {
    const bucketId = req.member.bucket_id;

    // Delete PDF if exists
    if (req.member.pdf_filename) {
      const filePath = path.join(__dirname, '../../uploads/pdfs', req.member.pdf_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Member.delete(req.params.id);
    req.session.success = 'Member deleted successfully';
    res.redirect(`/buckets/${bucketId}`);
  } catch (err) {
    console.error('Delete member error:', err);
    req.session.error = 'Error deleting member';
    res.redirect('/dashboard');
  }
});

module.exports = router;
