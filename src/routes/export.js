const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { requireUnionAdmin } = require('../middleware/auth');
const Bucket = require('../models/Bucket');
const Member = require('../models/Member');

router.use(requireUnionAdmin);

// Export bucket members in good standing to Excel
router.get('/bucket/:id', async (req, res) => {
  try {
    const bucket = await Bucket.findById(req.params.id);
    if (!bucket) {
      req.session.error = 'Bucket not found';
      return res.redirect('/dashboard');
    }

    // Check access
    if (req.session.role !== 'super_admin' && bucket.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/dashboard');
    }

    // Get members in good standing (have PDF)
    const members = await Member.findGoodStandingByBucketId(req.params.id);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MigsList';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Members in Good Standing');

    // Define columns
    sheet.columns = [
      { header: 'First Name', key: 'firstName', width: 15 },
      { header: 'Last Name', key: 'lastName', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'State', key: 'state', width: 10 },
      { header: 'ZIP', key: 'zip', width: 10 },
      { header: 'PDF Uploaded', key: 'pdfDate', width: 15 }
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data
    members.forEach(member => {
      const address = [member.address_line1, member.address_line2]
        .filter(Boolean)
        .join(', ');

      sheet.addRow({
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email || '',
        phone: member.phone || '',
        address: address,
        city: member.city || '',
        state: member.state || '',
        zip: member.zip || '',
        pdfDate: member.pdf_uploaded_at
          ? new Date(member.pdf_uploaded_at).toLocaleDateString()
          : ''
      });
    });

    // Set response headers
    const filename = `${bucket.name.replace(/[^a-z0-9]/gi, '_')}_good_standing_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    req.session.error = 'Error exporting data';
    res.redirect('/dashboard');
  }
});

// Export all bucket members to Excel
router.get('/bucket/:id/all', async (req, res) => {
  try {
    const bucket = await Bucket.findById(req.params.id);
    if (!bucket) {
      req.session.error = 'Bucket not found';
      return res.redirect('/dashboard');
    }

    // Check access
    if (req.session.role !== 'super_admin' && bucket.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/dashboard');
    }

    // Get all members
    const members = await Member.findByBucketId(req.params.id);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MigsList';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('All Members');

    // Define columns
    sheet.columns = [
      { header: 'First Name', key: 'firstName', width: 15 },
      { header: 'Last Name', key: 'lastName', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'State', key: 'state', width: 10 },
      { header: 'ZIP', key: 'zip', width: 10 },
      { header: 'Good Standing', key: 'goodStanding', width: 15 },
      { header: 'PDF Uploaded', key: 'pdfDate', width: 15 }
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data
    members.forEach(member => {
      const address = [member.address_line1, member.address_line2]
        .filter(Boolean)
        .join(', ');

      sheet.addRow({
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email || '',
        phone: member.phone || '',
        address: address,
        city: member.city || '',
        state: member.state || '',
        zip: member.zip || '',
        goodStanding: member.pdf_filename ? 'Yes' : 'No',
        pdfDate: member.pdf_uploaded_at
          ? new Date(member.pdf_uploaded_at).toLocaleDateString()
          : ''
      });
    });

    // Set response headers
    const filename = `${bucket.name.replace(/[^a-z0-9]/gi, '_')}_all_members_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    req.session.error = 'Error exporting data';
    res.redirect('/dashboard');
  }
});

module.exports = router;
