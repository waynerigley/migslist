const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { requireUnionAdmin } = require('../middleware/auth');
const Bucket = require('../models/Bucket');
const Member = require('../models/Member');
const Union = require('../models/Union');

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

// Export bucket members in good standing to PDF
router.get('/bucket/:id/pdf', async (req, res) => {
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
    const exportDate = new Date();
    const formattedDate = exportDate.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Toronto'
    });

    // Create PDF
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 50,
      bufferPages: true
    });

    // Set response headers
    const filename = `${bucket.name.replace(/[^a-z0-9]/gi, '_')}_good_standing_${exportDate.toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text(`#${bucket.number} - ${bucket.name}`, { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Members in Good Standing', { align: 'center' });
    doc.moveDown(0.5);

    // Export info
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Export Date: ${formattedDate}`, { align: 'center' });
    doc.text(`Total Members: ${members.length}`, { align: 'center' });
    doc.moveDown(1);

    // Table header
    const tableTop = doc.y;
    const col1 = 50;   // Name
    const col2 = 200;  // Email
    const col3 = 370;  // Phone
    const col4 = 470;  // Status
    const rowHeight = 20;

    // Draw header background
    doc.rect(col1 - 5, tableTop - 5, 520, rowHeight + 5).fill('#059669');

    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    doc.text('Name', col1, tableTop, { width: 145 });
    doc.text('Email', col2, tableTop, { width: 165 });
    doc.text('Phone', col3, tableTop, { width: 95 });
    doc.text('Status', col4, tableTop, { width: 80 });

    doc.fillColor('black').font('Helvetica').fontSize(9);

    let y = tableTop + rowHeight + 5;
    let rowCount = 0;

    members.forEach((member) => {
      // Check if we need a new page
      if (y > 700) {
        doc.addPage();
        y = 50;

        // Repeat header on new page
        doc.rect(col1 - 5, y - 5, 520, rowHeight + 5).fill('#059669');
        doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
        doc.text('Name', col1, y, { width: 145 });
        doc.text('Email', col2, y, { width: 165 });
        doc.text('Phone', col3, y, { width: 95 });
        doc.text('Status', col4, y, { width: 80 });
        doc.fillColor('black').font('Helvetica').fontSize(9);
        y += rowHeight + 5;
      }

      // Alternate row colors
      if (rowCount % 2 === 0) {
        doc.rect(col1 - 5, y - 2, 520, rowHeight).fill('#f0fdf4');
        doc.fillColor('black');
      }

      const fullName = `${member.first_name} ${member.last_name}`;

      doc.text(fullName, col1, y, { width: 145, ellipsis: true });
      doc.text(member.email || '-', col2, y, { width: 165, ellipsis: true });
      doc.text(member.phone || '-', col3, y, { width: 95, ellipsis: true });
      doc.text('Good Standing', col4, y, { width: 80 });

      y += rowHeight;
      rowCount++;
    });

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica');
      doc.text(
        `Page ${i + 1} of ${pages.count} | Generated by MIGS List | ${formattedDate}`,
        50,
        750,
        { align: 'center', width: 512 }
      );
    }

    doc.end();
  } catch (err) {
    console.error('Export error:', err);
    req.session.error = 'Error exporting data';
    res.redirect('/dashboard');
  }
});

// Export all bucket members to PDF
router.get('/bucket/:id/all/pdf', async (req, res) => {
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
    const exportDate = new Date();
    const formattedDate = exportDate.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Toronto'
    });

    // Create PDF
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 50,
      bufferPages: true
    });

    // Set response headers
    const filename = `${bucket.name.replace(/[^a-z0-9]/gi, '_')}_all_members_${exportDate.toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text(`#${bucket.number} - ${bucket.name}`, { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('All Members', { align: 'center' });
    doc.moveDown(0.5);

    // Export info
    const goodStandingCount = members.filter(m => m.pdf_filename).length;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Export Date: ${formattedDate}`, { align: 'center' });
    doc.text(`Total Members: ${members.length} (${goodStandingCount} in good standing)`, { align: 'center' });
    doc.moveDown(1);

    // Table header
    const tableTop = doc.y;
    const col1 = 50;   // Name
    const col2 = 200;  // Email
    const col3 = 370;  // Phone
    const col4 = 470;  // Status
    const rowHeight = 20;

    // Draw header background
    doc.rect(col1 - 5, tableTop - 5, 520, rowHeight + 5).fill('#2563eb');

    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    doc.text('Name', col1, tableTop, { width: 145 });
    doc.text('Email', col2, tableTop, { width: 165 });
    doc.text('Phone', col3, tableTop, { width: 95 });
    doc.text('Status', col4, tableTop, { width: 80 });

    doc.fillColor('black').font('Helvetica').fontSize(9);

    let y = tableTop + rowHeight + 5;
    let rowCount = 0;

    members.forEach((member) => {
      // Check if we need a new page
      if (y > 700) {
        doc.addPage();
        y = 50;

        // Repeat header on new page
        doc.rect(col1 - 5, y - 5, 520, rowHeight + 5).fill('#2563eb');
        doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
        doc.text('Name', col1, y, { width: 145 });
        doc.text('Email', col2, y, { width: 165 });
        doc.text('Phone', col3, y, { width: 95 });
        doc.text('Status', col4, y, { width: 80 });
        doc.fillColor('black').font('Helvetica').fontSize(9);
        y += rowHeight + 5;
      }

      // Alternate row colors
      if (rowCount % 2 === 0) {
        doc.rect(col1 - 5, y - 2, 520, rowHeight).fill('#f3f4f6');
        doc.fillColor('black');
      }

      const fullName = `${member.first_name} ${member.last_name}`;
      const status = member.pdf_filename ? 'Good Standing' : 'Pending';

      doc.text(fullName, col1, y, { width: 145, ellipsis: true });
      doc.text(member.email || '-', col2, y, { width: 165, ellipsis: true });
      doc.text(member.phone || '-', col3, y, { width: 95, ellipsis: true });
      doc.text(status, col4, y, { width: 80 });

      y += rowHeight;
      rowCount++;
    });

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica');
      doc.text(
        `Page ${i + 1} of ${pages.count} | Generated by MIGS List | ${formattedDate}`,
        50,
        750,
        { align: 'center', width: 512 }
      );
    }

    doc.end();
  } catch (err) {
    console.error('Export error:', err);
    req.session.error = 'Error exporting data';
    res.redirect('/dashboard');
  }
});

// Export all union members (Rank-and-File) to Excel
router.get('/rank-and-file/excel', async (req, res) => {
  try {
    const unionId = req.session.unionId;
    if (!unionId) {
      req.session.error = 'No union context';
      return res.redirect('/dashboard');
    }

    const union = await Union.findById(unionId);
    const members = await Member.findAllByUnionId(unionId);
    const exportDate = new Date();
    const formattedDate = exportDate.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MigsList';
    workbook.created = exportDate;

    const sheet = workbook.addWorksheet('Rank-and-File Members');

    // Add title and date
    sheet.mergeCells('A1:H1');
    sheet.getCell('A1').value = `${union.name} - Rank-and-File Members`;
    sheet.getCell('A1').font = { bold: true, size: 16 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:H2');
    sheet.getCell('A2').value = `Export Date: ${formattedDate}`;
    sheet.getCell('A2').font = { italic: true, size: 11 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells('A3:H3');
    sheet.getCell('A3').value = `Total Members: ${members.length}`;
    sheet.getCell('A3').font = { bold: true, size: 11 };
    sheet.getCell('A3').alignment = { horizontal: 'center' };

    // Empty row
    sheet.addRow([]);

    // Define columns starting at row 5
    sheet.columns = [
      { header: 'Unit/Sectional', key: 'bucket', width: 20 },
      { header: 'First Name', key: 'firstName', width: 15 },
      { header: 'Last Name', key: 'lastName', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'Province', key: 'state', width: 10 }
    ];

    // Add header row at row 5
    const headerRow = sheet.getRow(5);
    headerRow.values = ['Unit/Sectional', 'First Name', 'Last Name', 'Email', 'Phone', 'Address', 'City', 'Province'];
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data starting at row 6
    let rowNum = 6;
    members.forEach(member => {
      const address = [member.address_line1, member.address_line2]
        .filter(Boolean)
        .join(', ');

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

    // Set response headers
    const filename = `${union.name.replace(/[^a-z0-9]/gi, '_')}_Rank_and_File_${exportDate.toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    req.session.error = 'Error exporting data';
    res.redirect('/dashboard');
  }
});

// Export all union members (Rank-and-File) to PDF
router.get('/rank-and-file/pdf', async (req, res) => {
  try {
    const unionId = req.session.unionId;
    if (!unionId) {
      req.session.error = 'No union context';
      return res.redirect('/dashboard');
    }

    const union = await Union.findById(unionId);
    const members = await Member.findAllByUnionId(unionId);
    const exportDate = new Date();
    const formattedDate = exportDate.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Toronto'
    });

    // Create PDF
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 50,
      bufferPages: true
    });

    // Set response headers
    const filename = `${union.name.replace(/[^a-z0-9]/gi, '_')}_Rank_and_File_${exportDate.toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text(union.name, { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Rank-and-File Members List', { align: 'center' });
    doc.moveDown(0.5);

    // Export info box
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Export Date: ${formattedDate}`, { align: 'center' });
    doc.text(`Total Members: ${members.length}`, { align: 'center' });
    doc.moveDown(0.5);

    // Legal notice
    doc.fontSize(8).font('Helvetica-Oblique');
    doc.text('This document is for official union use only. For Legislative Strike Vote or Ratification Vote purposes.', { align: 'center' });
    doc.moveDown(1);

    // Table header
    const tableTop = doc.y;
    const col1 = 50;   // Unit
    const col2 = 150;  // Name
    const col3 = 300;  // Email
    const col4 = 450;  // Phone
    const rowHeight = 18;

    // Draw header background
    doc.rect(col1 - 5, tableTop - 5, 520, rowHeight + 5).fill('#2563eb');

    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('Unit', col1, tableTop, { width: 95 });
    doc.text('Name', col2, tableTop, { width: 145 });
    doc.text('Email', col3, tableTop, { width: 145 });
    doc.text('Phone', col4, tableTop, { width: 80 });

    doc.fillColor('black').font('Helvetica').fontSize(8);

    let y = tableTop + rowHeight + 5;
    let currentBucket = null;
    let rowCount = 0;

    members.forEach((member, index) => {
      // Check if we need a new page
      if (y > 700) {
        doc.addPage();
        y = 50;

        // Repeat header on new page
        doc.rect(col1 - 5, y - 5, 520, rowHeight + 5).fill('#2563eb');
        doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
        doc.text('Unit', col1, y, { width: 95 });
        doc.text('Name', col2, y, { width: 145 });
        doc.text('Email', col3, y, { width: 145 });
        doc.text('Phone', col4, y, { width: 80 });
        doc.fillColor('black').font('Helvetica').fontSize(8);
        y += rowHeight + 5;
      }

      // Alternate row colors
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

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica');
      doc.text(
        `Page ${i + 1} of ${pages.count} | Generated by MIGS List | ${formattedDate}`,
        50,
        750,
        { align: 'center', width: 512 }
      );
    }

    doc.end();
  } catch (err) {
    console.error('Export error:', err);
    req.session.error = 'Error exporting data';
    res.redirect('/dashboard');
  }
});

module.exports = router;
