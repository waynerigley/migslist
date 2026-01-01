const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireUnionAdmin } = require('../middleware/auth');
const Bucket = require('../models/Bucket');
const Member = require('../models/Member');
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/pdfs'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bucket-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for master PDFs
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Configure multer for Excel uploads (memory storage)
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for Excel files
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});

router.use(requireUnionAdmin);

// Helper to check bucket ownership
async function checkBucketAccess(req, res, next) {
  try {
    const bucket = await Bucket.findById(req.params.id);
    if (!bucket) {
      req.session.error = 'Bucket not found';
      return res.redirect('/dashboard');
    }

    // Super admins can access any bucket
    if (req.session.role === 'super_admin') {
      req.bucket = bucket;
      return next();
    }

    // Union admins can only access their union's buckets
    if (bucket.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/dashboard');
    }

    req.bucket = bucket;
    next();
  } catch (err) {
    console.error('Bucket access check error:', err);
    req.session.error = 'Error accessing bucket';
    res.redirect('/dashboard');
  }
}

// New bucket form
router.get('/new', (req, res) => {
  res.render('buckets/edit', { bucket: null, memberCount: 0 });
});

// Create bucket (with optional master PDF)
router.post('/', upload.single('master_pdf'), async (req, res) => {
  try {
    const { number, name } = req.body;
    const unionId = req.session.unionId;

    if (!unionId) {
      req.session.error = 'No union context';
      return res.redirect('/dashboard');
    }

    if (!number || !name) {
      req.session.error = 'Bucket number and name are required';
      return res.redirect('/buckets/new');
    }

    const bucket = await Bucket.create({ unionId, number: number.trim(), name: name.trim() });

    // If master PDF was uploaded, attach it
    if (req.file) {
      try {
        await Bucket.updateMasterPdf(bucket.id, req.file.filename);
      } catch (pdfErr) {
        console.error('Error attaching PDF to bucket:', pdfErr);
        // PDF failed but bucket was created - still redirect with success
      }
    }

    req.session.success = 'Unit/Sectional created successfully';
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Create bucket error:', err);
    if (err.code === '23505') {
      req.session.error = 'A unit with this number already exists';
    } else {
      req.session.error = 'Error creating unit';
    }
    res.redirect('/buckets/new');
  }
});

// View bucket (list members)
router.get('/:id', checkBucketAccess, async (req, res) => {
  try {
    const members = await Member.findByBucketId(req.params.id);
    const retiredMembers = await Member.findRetiredByBucketId(req.params.id);
    res.render('buckets/view', { bucket: req.bucket, members, retiredCount: retiredMembers.length });
  } catch (err) {
    console.error('View bucket error:', err);
    req.session.error = 'Error loading bucket';
    res.redirect('/dashboard');
  }
});

// View retired members
router.get('/:id/retired', checkBucketAccess, async (req, res) => {
  try {
    const members = await Member.findRetiredByBucketId(req.params.id);
    res.render('buckets/retired', { bucket: req.bucket, members });
  } catch (err) {
    console.error('View retired members error:', err);
    req.session.error = 'Error loading retired members';
    res.redirect(`/buckets/${req.params.id}`);
  }
});

// Edit bucket form
router.get('/:id/edit', checkBucketAccess, async (req, res) => {
  const members = await Member.findByBucketId(req.params.id);
  res.render('buckets/edit', { bucket: req.bucket, memberCount: members.length });
});

// Update bucket
router.post('/:id', checkBucketAccess, async (req, res) => {
  try {
    const { number, name } = req.body;

    if (!number || !name) {
      req.session.error = 'Bucket number and name are required';
      return res.redirect(`/buckets/${req.params.id}/edit`);
    }

    await Bucket.update(req.params.id, { number: number.trim(), name: name.trim() });
    req.session.success = 'Bucket updated successfully';
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Update bucket error:', err);
    if (err.code === '23505') {
      req.session.error = 'A bucket with this number already exists';
    } else {
      req.session.error = 'Error updating bucket';
    }
    res.redirect(`/buckets/${req.params.id}/edit`);
  }
});

// Delete bucket (president only)
router.post('/:id/delete', checkBucketAccess, async (req, res) => {
  try {
    // Only presidents and super admins can delete buckets
    if (!['union_president', 'union_admin', 'super_admin'].includes(req.session.role)) {
      req.session.error = 'Only the President can delete buckets';
      return res.redirect(`/buckets/${req.params.id}/edit`);
    }
    await Bucket.delete(req.params.id);
    req.session.success = 'Bucket deleted successfully';
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Delete bucket error:', err);
    req.session.error = 'Error deleting bucket';
    res.redirect('/dashboard');
  }
});

// Upload master PDF
router.post('/:id/upload-master-pdf', checkBucketAccess, upload.single('master_pdf'), async (req, res) => {
  try {
    if (!req.file) {
      req.session.error = 'Please select a PDF file';
      return res.redirect(`/buckets/${req.params.id}/edit`);
    }

    // Delete old PDF if exists
    if (req.bucket.master_pdf_filename) {
      const oldPath = path.join(__dirname, '../../uploads/pdfs', req.bucket.master_pdf_filename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await Bucket.updateMasterPdf(req.params.id, req.file.filename);
    req.session.success = 'Master PDF uploaded successfully';
    res.redirect(`/buckets/${req.params.id}/edit`);
  } catch (err) {
    console.error('Upload master PDF error:', err);
    req.session.error = 'Error uploading PDF';
    res.redirect(`/buckets/${req.params.id}/edit`);
  }
});

// Download master PDF
router.get('/:id/master-pdf', checkBucketAccess, async (req, res) => {
  try {
    if (!req.bucket.master_pdf_filename) {
      req.session.error = 'No master PDF on file';
      return res.redirect(`/buckets/${req.params.id}`);
    }

    const filePath = path.join(__dirname, '../../uploads/pdfs', req.bucket.master_pdf_filename);
    if (!fs.existsSync(filePath)) {
      req.session.error = 'PDF file not found';
      return res.redirect(`/buckets/${req.params.id}`);
    }

    const downloadName = `${req.bucket.name.replace(/[^a-z0-9]/gi, '_')}_master.pdf`;
    res.download(filePath, downloadName);
  } catch (err) {
    console.error('Download master PDF error:', err);
    req.session.error = 'Error downloading PDF';
    res.redirect(`/buckets/${req.params.id}`);
  }
});

// Remove master PDF
router.post('/:id/remove-master-pdf', checkBucketAccess, async (req, res) => {
  try {
    if (req.bucket.master_pdf_filename) {
      const filePath = path.join(__dirname, '../../uploads/pdfs', req.bucket.master_pdf_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await Bucket.removeMasterPdf(req.params.id);
    }
    req.session.success = 'Master PDF removed';
    res.redirect(`/buckets/${req.params.id}/edit`);
  } catch (err) {
    console.error('Remove master PDF error:', err);
    req.session.error = 'Error removing PDF';
    res.redirect(`/buckets/${req.params.id}/edit`);
  }
});

// Email member with master PDF attached
router.post('/:id/email-member/:memberId', checkBucketAccess, async (req, res) => {
  try {
    const member = await Member.findById(req.params.memberId);
    if (!member) {
      req.session.error = 'Member not found';
      return res.redirect(`/buckets/${req.params.id}`);
    }

    if (!member.email) {
      req.session.error = 'Member does not have an email address';
      return res.redirect(`/buckets/${req.params.id}`);
    }

    if (!req.bucket.master_pdf_filename) {
      req.session.error = 'No master PDF uploaded for this bucket';
      return res.redirect(`/buckets/${req.params.id}`);
    }

    const pdfPath = path.join(__dirname, '../../uploads/pdfs', req.bucket.master_pdf_filename);
    if (!fs.existsSync(pdfPath)) {
      req.session.error = 'Master PDF file not found';
      return res.redirect(`/buckets/${req.params.id}`);
    }

    if (!process.env.SENDGRID_API_KEY) {
      req.session.error = 'Email service not configured';
      return res.redirect(`/buckets/${req.params.id}`);
    }

    // Read PDF and convert to base64
    const pdfContent = fs.readFileSync(pdfPath).toString('base64');

    await sgMail.send({
      to: member.email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: `Action Required: ${req.bucket.name} - Document Signature`,
      html: `
        <h2>Hello ${member.first_name},</h2>
        <p>Please find attached the document that requires your signature for <strong>${req.bucket.name}</strong>.</p>
        <p>Once signed, please return this document to your union representative.</p>
        <p>Thank you,<br>Your Union Local</p>
      `,
      attachments: [
        {
          content: pdfContent,
          filename: `${req.bucket.name.replace(/[^a-z0-9]/gi, '_')}_document.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    });

    req.session.success = `Email sent to ${member.first_name} ${member.last_name}`;
    res.redirect(`/buckets/${req.params.id}`);
  } catch (err) {
    console.error('Email member error:', err);
    req.session.error = 'Error sending email';
    res.redirect(`/buckets/${req.params.id}`);
  }
});

// Import members from Excel
router.post('/:id/import-members', checkBucketAccess, excelUpload.single('memberFile'), async (req, res) => {
  try {
    if (!req.file) {
      req.session.error = 'Please select a file to upload';
      return res.redirect(`/buckets/${req.params.id}`);
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.getWorksheet('Members') || workbook.getWorksheet(1);
    if (!worksheet) {
      req.session.error = 'Could not find Members worksheet in the file';
      return res.redirect(`/buckets/${req.params.id}`);
    }

    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const membersToCreate = [];

    // Collect all members to create
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const firstName = row.getCell(1).value?.toString().trim();
      const lastName = row.getCell(2).value?.toString().trim();

      // Skip empty rows
      if (!firstName || !lastName) {
        skippedCount++;
        return;
      }

      // Skip sample data rows
      if ((firstName === 'John' && lastName === 'Smith') ||
          (firstName === 'Jane' && lastName === 'Doe') ||
          (firstName === 'Bob' && lastName === 'Wilson')) {
        skippedCount++;
        return;
      }

      membersToCreate.push({
        rowNumber,
        firstName,
        lastName,
        email: row.getCell(3).value?.toString().trim() || null,
        phone: row.getCell(4).value?.toString().trim() || null,
        addressLine1: row.getCell(5).value?.toString().trim() || null,
        addressLine2: row.getCell(6).value?.toString().trim() || null,
        city: row.getCell(7).value?.toString().trim() || null,
        province: row.getCell(8).value?.toString().trim() || null,
        postalCode: row.getCell(9).value?.toString().trim() || null
      });
    });

    // Create members sequentially
    for (const m of membersToCreate) {
      try {
        await Member.create({
          bucketId: req.params.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          phone: m.phone,
          addressLine1: m.addressLine1,
          addressLine2: m.addressLine2,
          city: m.city,
          state: m.province,
          zip: m.postalCode
        });
        importedCount++;
      } catch (err) {
        errors.push(`Row ${m.rowNumber}: ${err.message}`);
      }
    }

    if (importedCount === 0 && membersToCreate.length === 0) {
      req.session.error = 'No members found in the file. Make sure to delete the sample rows and add your data.';
    } else if (errors.length > 0) {
      req.session.error = `Imported ${importedCount} members with ${errors.length} errors`;
    } else {
      req.session.success = `Successfully imported ${importedCount} member${importedCount !== 1 ? 's' : ''}`;
    }

    res.redirect(`/buckets/${req.params.id}`);
  } catch (err) {
    console.error('Import members error:', err);
    req.session.error = 'Error importing members: ' + err.message;
    res.redirect(`/buckets/${req.params.id}`);
  }
});

module.exports = router;
