const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { requireSuperAdmin } = require('../middleware/auth');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Invoice = require('../models/Invoice');
const Union = require('../models/Union');

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/receipts');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'));
    }
  }
});

// Apply super admin middleware to all routes
router.use(requireSuperAdmin);

// ============================================
// DASHBOARD
// ============================================

router.get('/', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // Get YTD totals
    const incomeYTD = await Income.getTotalByYear(currentYear);
    const expensesYTD = await Expense.getTotalByYear(currentYear);
    const netProfit = incomeYTD - expensesYTD;

    // Get recent transactions
    const recentIncome = await Income.getRecentTransactions(5);
    const recentExpenses = await Expense.getRecentTransactions(5);

    // Get invoice stats
    const invoiceStats = await Invoice.getStats();
    const outstandingInvoices = await Invoice.findOutstanding();

    // Update overdue invoices
    await Invoice.updateOverdueInvoices();

    res.render('admin/finance/dashboard', {
      currentYear,
      incomeYTD,
      expensesYTD,
      netProfit,
      recentIncome,
      recentExpenses,
      invoiceStats,
      outstandingInvoices
    });
  } catch (err) {
    console.error('Finance dashboard error:', err);
    req.session.error = 'Error loading finance dashboard';
    res.redirect('/admin');
  }
});

// ============================================
// INCOME
// ============================================

// List all income
router.get('/income', async (req, res) => {
  try {
    const { year, method } = req.query;
    let income;

    if (year) {
      income = await Income.findByYear(parseInt(year));
    } else {
      income = await Income.findAll();
    }

    // Get available years for filter
    const allIncome = await Income.findAll();
    const years = [...new Set(allIncome.map(i => new Date(i.received_date).getFullYear()))].sort((a, b) => b - a);

    res.render('admin/finance/income/list', { income, years, selectedYear: year });
  } catch (err) {
    console.error('List income error:', err);
    req.session.error = 'Error loading income';
    res.redirect('/admin/finance');
  }
});

// New income form
router.get('/income/new', async (req, res) => {
  try {
    const unions = await Union.findAll();
    res.render('admin/finance/income/edit', { income: null, unions });
  } catch (err) {
    console.error('New income form error:', err);
    req.session.error = 'Error loading form';
    res.redirect('/admin/finance/income');
  }
});

// Create income
router.post('/income', async (req, res) => {
  try {
    const { union_id, amount, payment_method, reference, description, received_date } = req.body;

    await Income.create({
      unionId: union_id || null,
      amount: parseFloat(amount),
      paymentMethod: payment_method,
      reference,
      description,
      receivedDate: received_date
    });

    req.session.success = 'Income recorded successfully';
    res.redirect('/admin/finance/income');
  } catch (err) {
    console.error('Create income error:', err);
    req.session.error = 'Error recording income';
    res.redirect('/admin/finance/income/new');
  }
});

// Edit income form
router.get('/income/:id/edit', async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);
    if (!income) {
      req.session.error = 'Income record not found';
      return res.redirect('/admin/finance/income');
    }

    const unions = await Union.findAll();
    res.render('admin/finance/income/edit', { income, unions });
  } catch (err) {
    console.error('Edit income form error:', err);
    req.session.error = 'Error loading form';
    res.redirect('/admin/finance/income');
  }
});

// Update income
router.post('/income/:id', async (req, res) => {
  try {
    const { union_id, amount, payment_method, reference, description, received_date } = req.body;

    await Income.update(req.params.id, {
      unionId: union_id || null,
      amount: parseFloat(amount),
      paymentMethod: payment_method,
      reference,
      description,
      receivedDate: received_date
    });

    req.session.success = 'Income updated successfully';
    res.redirect('/admin/finance/income');
  } catch (err) {
    console.error('Update income error:', err);
    req.session.error = 'Error updating income';
    res.redirect(`/admin/finance/income/${req.params.id}/edit`);
  }
});

// Delete income
router.post('/income/:id/delete', async (req, res) => {
  try {
    await Income.delete(req.params.id);
    req.session.success = 'Income record deleted';
    res.redirect('/admin/finance/income');
  } catch (err) {
    console.error('Delete income error:', err);
    req.session.error = 'Error deleting income';
    res.redirect('/admin/finance/income');
  }
});

// ============================================
// EXPENSES
// ============================================

// List all expenses
router.get('/expenses', async (req, res) => {
  try {
    const { year, category } = req.query;
    let expenses;

    if (year) {
      expenses = await Expense.findByYear(parseInt(year));
    } else if (category) {
      expenses = await Expense.findByCategory(category);
    } else {
      expenses = await Expense.findAll();
    }

    // Get available years and categories for filters
    const allExpenses = await Expense.findAll();
    const years = [...new Set(allExpenses.map(e => new Date(e.expense_date).getFullYear()))].sort((a, b) => b - a);
    const categories = Expense.getCategories();

    res.render('admin/finance/expenses/list', { expenses, years, categories, selectedYear: year, selectedCategory: category });
  } catch (err) {
    console.error('List expenses error:', err);
    req.session.error = 'Error loading expenses';
    res.redirect('/admin/finance');
  }
});

// New expense form
router.get('/expenses/new', (req, res) => {
  const categories = Expense.getCategories();
  const vendors = Expense.getVendors();
  res.render('admin/finance/expenses/edit', { expense: null, categories, vendors });
});

// Create expense
router.post('/expenses', upload.single('receipt'), async (req, res) => {
  try {
    const { category, vendor, description, amount, currency, expense_date, expires_at } = req.body;

    await Expense.create({
      category,
      vendor,
      description,
      amount: parseFloat(amount),
      currency: currency || 'CAD',
      expenseDate: expense_date,
      expiresAt: expires_at || null,
      receiptFilename: req.file ? req.file.filename : null
    });

    req.session.success = 'Expense recorded successfully';
    res.redirect('/admin/finance/expenses');
  } catch (err) {
    console.error('Create expense error:', err);
    req.session.error = 'Error recording expense';
    res.redirect('/admin/finance/expenses/new');
  }
});

// Edit expense form
router.get('/expenses/:id/edit', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      req.session.error = 'Expense record not found';
      return res.redirect('/admin/finance/expenses');
    }

    const categories = Expense.getCategories();
    const vendors = Expense.getVendors();
    res.render('admin/finance/expenses/edit', { expense, categories, vendors });
  } catch (err) {
    console.error('Edit expense form error:', err);
    req.session.error = 'Error loading form';
    res.redirect('/admin/finance/expenses');
  }
});

// Update expense
router.post('/expenses/:id', upload.single('receipt'), async (req, res) => {
  try {
    const { category, vendor, description, amount, currency, expense_date, expires_at } = req.body;
    const expense = await Expense.findById(req.params.id);

    await Expense.update(req.params.id, {
      category,
      vendor,
      description,
      amount: parseFloat(amount),
      currency: currency || 'CAD',
      expenseDate: expense_date,
      expiresAt: expires_at || null,
      receiptFilename: req.file ? req.file.filename : expense.receipt_filename
    });

    req.session.success = 'Expense updated successfully';
    res.redirect('/admin/finance/expenses');
  } catch (err) {
    console.error('Update expense error:', err);
    req.session.error = 'Error updating expense';
    res.redirect(`/admin/finance/expenses/${req.params.id}/edit`);
  }
});

// View receipt
router.get('/expenses/:id/receipt', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense || !expense.receipt_filename) {
      req.session.error = 'Receipt not found';
      return res.redirect('/admin/finance/expenses');
    }

    const filePath = path.join(__dirname, '../../uploads/receipts', expense.receipt_filename);
    res.sendFile(filePath);
  } catch (err) {
    console.error('View receipt error:', err);
    req.session.error = 'Error loading receipt';
    res.redirect('/admin/finance/expenses');
  }
});

// Delete expense
router.post('/expenses/:id/delete', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    // Delete receipt file if exists
    if (expense && expense.receipt_filename) {
      const filePath = path.join(__dirname, '../../uploads/receipts', expense.receipt_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Expense.delete(req.params.id);
    req.session.success = 'Expense record deleted';
    res.redirect('/admin/finance/expenses');
  } catch (err) {
    console.error('Delete expense error:', err);
    req.session.error = 'Error deleting expense';
    res.redirect('/admin/finance/expenses');
  }
});

// ============================================
// INVOICES
// ============================================

// List all invoices
router.get('/invoices', async (req, res) => {
  try {
    const { status, year } = req.query;
    let invoices;

    // Update overdue invoices first
    await Invoice.updateOverdueInvoices();

    if (status) {
      invoices = await Invoice.findByStatus(status);
    } else if (year) {
      invoices = await Invoice.findByYear(parseInt(year));
    } else {
      invoices = await Invoice.findAll();
    }

    // Get available years for filter
    const allInvoices = await Invoice.findAll();
    const years = [...new Set(allInvoices.map(i => new Date(i.issue_date).getFullYear()))].sort((a, b) => b - a);

    res.render('admin/finance/invoices/list', { invoices, years, selectedStatus: status, selectedYear: year });
  } catch (err) {
    console.error('List invoices error:', err);
    req.session.error = 'Error loading invoices';
    res.redirect('/admin/finance');
  }
});

// New invoice form
router.get('/invoices/new', async (req, res) => {
  try {
    const unions = await Union.findAll();
    const preselectedUnion = req.query.union_id;
    res.render('admin/finance/invoices/edit', { invoice: null, unions, preselectedUnion });
  } catch (err) {
    console.error('New invoice form error:', err);
    req.session.error = 'Error loading form';
    res.redirect('/admin/finance/invoices');
  }
});

// Create invoice
router.post('/invoices', async (req, res) => {
  try {
    const { union_id, amount, issue_date, due_date, notes } = req.body;

    const invoice = await Invoice.create({
      unionId: union_id,
      amount: parseFloat(amount),
      issueDate: issue_date,
      dueDate: due_date,
      notes
    });

    req.session.success = `Invoice ${invoice.invoice_number} created successfully`;
    res.redirect('/admin/finance/invoices');
  } catch (err) {
    console.error('Create invoice error:', err);
    req.session.error = 'Error creating invoice';
    res.redirect('/admin/finance/invoices/new');
  }
});

// View invoice (printable)
router.get('/invoices/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      req.session.error = 'Invoice not found';
      return res.redirect('/admin/finance/invoices');
    }

    res.render('admin/finance/invoices/view', { invoice, layout: false });
  } catch (err) {
    console.error('View invoice error:', err);
    req.session.error = 'Error loading invoice';
    res.redirect('/admin/finance/invoices');
  }
});

// Edit invoice form
router.get('/invoices/:id/edit', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      req.session.error = 'Invoice not found';
      return res.redirect('/admin/finance/invoices');
    }

    const unions = await Union.findAll();
    res.render('admin/finance/invoices/edit', { invoice, unions, preselectedUnion: null });
  } catch (err) {
    console.error('Edit invoice form error:', err);
    req.session.error = 'Error loading form';
    res.redirect('/admin/finance/invoices');
  }
});

// Update invoice
router.post('/invoices/:id', async (req, res) => {
  try {
    const { union_id, amount, issue_date, due_date, status, notes } = req.body;

    await Invoice.update(req.params.id, {
      unionId: union_id,
      amount: parseFloat(amount),
      issueDate: issue_date,
      dueDate: due_date,
      status,
      notes
    });

    req.session.success = 'Invoice updated successfully';
    res.redirect('/admin/finance/invoices');
  } catch (err) {
    console.error('Update invoice error:', err);
    req.session.error = 'Error updating invoice';
    res.redirect(`/admin/finance/invoices/${req.params.id}/edit`);
  }
});

// Mark invoice as sent
router.post('/invoices/:id/send', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      req.session.error = 'Invoice not found';
      return res.redirect('/admin/finance/invoices');
    }

    await Invoice.markSent(req.params.id);

    // TODO: Send email with invoice PDF

    req.session.success = `Invoice ${invoice.invoice_number} marked as sent`;
    res.redirect('/admin/finance/invoices');
  } catch (err) {
    console.error('Send invoice error:', err);
    req.session.error = 'Error sending invoice';
    res.redirect('/admin/finance/invoices');
  }
});

// Mark invoice as paid
router.post('/invoices/:id/mark-paid', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      req.session.error = 'Invoice not found';
      return res.redirect('/admin/finance/invoices');
    }

    await Invoice.markPaid(req.params.id);

    req.session.success = `Invoice ${invoice.invoice_number} marked as paid`;
    res.redirect('/admin/finance/invoices');
  } catch (err) {
    console.error('Mark paid error:', err);
    req.session.error = 'Error updating invoice';
    res.redirect('/admin/finance/invoices');
  }
});

// Download invoice PDF
router.get('/invoices/:id/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      req.session.error = 'Invoice not found';
      return res.redirect('/admin/finance/invoices');
    }

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoice_number}.pdf`);

    doc.pipe(res);

    // Colors
    const primaryColor = '#2563eb';
    const darkGray = '#374151';
    const lightGray = '#9ca3af';

    // Header with colored bar
    doc.rect(0, 0, 612, 80).fill(primaryColor);

    // Company name in header
    doc.fillColor('white')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('MIGS LIST', 50, 28);

    // Invoice label
    doc.fontSize(24)
       .text('INVOICE', 400, 28, { align: 'right', width: 162 });

    // Reset color
    doc.fillColor(darkGray);

    // Invoice details box (right side)
    const detailsBoxTop = 100;
    doc.rect(380, detailsBoxTop, 182, 80).stroke(lightGray);

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Invoice Number:', 390, detailsBoxTop + 10);
    doc.text('Issue Date:', 390, detailsBoxTop + 30);
    doc.text('Due Date:', 390, detailsBoxTop + 50);

    doc.font('Helvetica').fillColor(darkGray);
    doc.text(invoice.invoice_number, 480, detailsBoxTop + 10, { width: 70, align: 'right' });
    doc.text(new Date(invoice.issue_date).toLocaleDateString('en-CA'), 480, detailsBoxTop + 30, { width: 70, align: 'right' });
    doc.text(new Date(invoice.due_date).toLocaleDateString('en-CA'), 480, detailsBoxTop + 50, { width: 70, align: 'right' });

    // From section (left side)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor);
    doc.text('FROM', 50, detailsBoxTop);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(darkGray);
    doc.text('Migs List', 50, detailsBoxTop + 18);
    doc.font('Helvetica').fontSize(10);
    doc.text('9880 Ridge Road', 50, detailsBoxTop + 34);
    doc.text('Windsor, Ontario N8R 1G6', 50, detailsBoxTop + 48);
    doc.text('Canada', 50, detailsBoxTop + 62);
    doc.fillColor(lightGray).text('BIN: 1001457886', 50, detailsBoxTop + 80);

    // Bill To section
    const billToTop = 210;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor);
    doc.text('BILL TO', 50, billToTop);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(darkGray);
    doc.text(invoice.union_name || 'N/A', 50, billToTop + 18);

    doc.font('Helvetica').fontSize(10);
    let billToY = billToTop + 36;
    if (invoice.contact_name) {
      doc.text(`President: ${invoice.contact_name}`, 50, billToY);
      billToY += 14;
    }
    if (invoice.contact_email) {
      doc.text(invoice.contact_email, 50, billToY);
      billToY += 14;
    }
    if (invoice.contact_phone) {
      doc.text(invoice.contact_phone, 50, billToY);
    }

    // Status badge
    const statusColors = {
      draft: '#6b7280',
      sent: '#f59e0b',
      paid: '#10b981',
      overdue: '#ef4444'
    };
    const statusColor = statusColors[invoice.status] || '#6b7280';
    doc.rect(380, billToTop, 80, 22).fill(statusColor);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
    doc.text(invoice.status.toUpperCase(), 385, billToTop + 6, { width: 70, align: 'center' });

    // Line items table
    const tableTop = 320;

    // Table header
    doc.rect(50, tableTop, 512, 25).fill('#f3f4f6');
    doc.fillColor(darkGray).font('Helvetica-Bold').fontSize(10);
    doc.text('DESCRIPTION', 60, tableTop + 8);
    doc.text('AMOUNT', 460, tableTop + 8, { width: 90, align: 'right' });

    // Table row
    doc.font('Helvetica').fontSize(10);
    doc.rect(50, tableTop + 25, 512, 35).stroke('#e5e7eb');
    doc.text('Annual Subscription - MIGS List Member Tracking System', 60, tableTop + 38);
    doc.text(`$${parseFloat(invoice.amount).toFixed(2)} CAD`, 460, tableTop + 38, { width: 90, align: 'right' });

    // Subtotal and Total
    const totalTop = tableTop + 70;
    doc.rect(350, totalTop, 212, 50).fill('#f3f4f6');

    doc.font('Helvetica').fontSize(10).fillColor(darkGray);
    doc.text('Subtotal:', 360, totalTop + 10);
    doc.text(`$${parseFloat(invoice.amount).toFixed(2)} CAD`, 460, totalTop + 10, { width: 90, align: 'right' });

    doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor);
    doc.text('Total Due:', 360, totalTop + 30);
    doc.text(`$${parseFloat(invoice.amount).toFixed(2)} CAD`, 460, totalTop + 30, { width: 90, align: 'right' });

    // Payment instructions box
    const paymentTop = 470;
    doc.rect(50, paymentTop, 512, 100).stroke(primaryColor);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor);
    doc.text('PAYMENT OPTIONS', 60, paymentTop + 12);

    doc.font('Helvetica').fontSize(10).fillColor(darkGray);
    doc.text('1. Interac e-Transfer', 60, paymentTop + 35);
    doc.font('Helvetica-Bold').text('    payments@migslist.com', 60, paymentTop + 49);

    doc.font('Helvetica').text('2. Cheque payable to "Migs List"', 60, paymentTop + 68);
    doc.text('    Mail to: 9880 Ridge Road, Windsor, Ontario N8R 1G6', 60, paymentTop + 82);

    doc.fillColor(lightGray).fontSize(9);
    doc.text('Please include your invoice number in the payment reference.', 300, paymentTop + 55, { width: 250, align: 'right' });

    // Notes section
    if (invoice.notes) {
      const notesTop = 585;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(darkGray);
      doc.text('Notes:', 50, notesTop);
      doc.font('Helvetica').fontSize(9).fillColor(lightGray);
      doc.text(invoice.notes, 50, notesTop + 14, { width: 512 });
    }

    // Footer
    doc.rect(0, 730, 612, 60).fill('#f9fafb');
    doc.fillColor(lightGray).font('Helvetica').fontSize(9);
    doc.text('Thank you for your business!', 50, 745, { align: 'center', width: 512 });
    doc.text('Questions? Contact us at support@migslist.com', 50, 760, { align: 'center', width: 512 });

    doc.end();
  } catch (err) {
    console.error('Generate invoice PDF error:', err);
    req.session.error = 'Error generating PDF';
    res.redirect('/admin/finance/invoices');
  }
});

// Delete invoice
router.post('/invoices/:id/delete', async (req, res) => {
  try {
    await Invoice.delete(req.params.id);
    req.session.success = 'Invoice deleted';
    res.redirect('/admin/finance/invoices');
  } catch (err) {
    console.error('Delete invoice error:', err);
    req.session.error = 'Error deleting invoice';
    res.redirect('/admin/finance/invoices');
  }
});

// ============================================
// PAYMENT RECEIPTS
// ============================================

// Generate payment receipt PDF
router.get('/receipts/:incomeId/pdf', async (req, res) => {
  try {
    const income = await Income.findById(req.params.incomeId);
    if (!income) {
      req.session.error = 'Payment record not found';
      return res.redirect('/admin/finance/income');
    }

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

    const receiptNumber = `RCP-${new Date(income.received_date).getFullYear()}-${income.id.substr(0, 8).toUpperCase()}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${receiptNumber}.pdf`);

    doc.pipe(res);

    // Colors
    const primaryColor = '#10b981'; // Green for receipts
    const darkGray = '#374151';
    const lightGray = '#9ca3af';

    // Header with colored bar
    doc.rect(0, 0, 612, 80).fill(primaryColor);

    // Company name in header
    doc.fillColor('white')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('MIGS LIST', 50, 28);

    // Receipt label
    doc.fontSize(24)
       .text('RECEIPT', 400, 28, { align: 'right', width: 162 });

    // Reset color
    doc.fillColor(darkGray);

    // Receipt details box (right side)
    const detailsBoxTop = 100;
    doc.rect(380, detailsBoxTop, 182, 60).stroke(lightGray);

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Receipt Number:', 390, detailsBoxTop + 10);
    doc.text('Date Received:', 390, detailsBoxTop + 30);

    doc.font('Helvetica').fillColor(darkGray);
    doc.text(receiptNumber, 390, detailsBoxTop + 10, { width: 160, align: 'right' });
    doc.text(new Date(income.received_date).toLocaleDateString('en-CA'), 390, detailsBoxTop + 30, { width: 160, align: 'right' });

    // From section (left side)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor);
    doc.text('FROM', 50, detailsBoxTop);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(darkGray);
    doc.text('Migs List', 50, detailsBoxTop + 18);
    doc.font('Helvetica').fontSize(10);
    doc.text('9880 Ridge Road', 50, detailsBoxTop + 34);
    doc.text('Windsor, Ontario N8R 1G6', 50, detailsBoxTop + 48);
    doc.text('Canada', 50, detailsBoxTop + 62);
    doc.fillColor(lightGray).text('BIN: 1001457886', 50, detailsBoxTop + 80);

    // Received From section
    const receivedFromTop = 210;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor);
    doc.text('RECEIVED FROM', 50, receivedFromTop);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(darkGray);
    doc.text(income.union_name || 'N/A', 50, receivedFromTop + 18);

    doc.font('Helvetica').fontSize(10);
    let receivedFromY = receivedFromTop + 36;
    if (income.contact_name) {
      doc.text(`President: ${income.contact_name}`, 50, receivedFromY);
      receivedFromY += 14;
    }
    if (income.contact_email) {
      doc.text(income.contact_email, 50, receivedFromY);
      receivedFromY += 14;
    }
    if (income.contact_phone) {
      doc.text(income.contact_phone, 50, receivedFromY);
    }

    // PAID badge
    doc.rect(380, receivedFromTop, 80, 22).fill(primaryColor);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
    doc.text('PAID', 385, receivedFromTop + 6, { width: 70, align: 'center' });

    // Payment details table
    const tableTop = 320;

    // Table header
    doc.rect(50, tableTop, 512, 25).fill('#f3f4f6');
    doc.fillColor(darkGray).font('Helvetica-Bold').fontSize(10);
    doc.text('DESCRIPTION', 60, tableTop + 8);
    doc.text('AMOUNT', 460, tableTop + 8, { width: 90, align: 'right' });

    // Table row
    const description = income.description || 'Annual Subscription - MIGS List Member Tracking System';
    doc.font('Helvetica').fontSize(10);
    doc.rect(50, tableTop + 25, 512, 35).stroke('#e5e7eb');
    doc.text(description, 60, tableTop + 38, { width: 350 });
    doc.text(`$${parseFloat(income.amount).toFixed(2)} CAD`, 460, tableTop + 38, { width: 90, align: 'right' });

    // Total received
    const totalTop = tableTop + 70;
    doc.rect(350, totalTop, 212, 30).fill('#d1fae5');

    doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor);
    doc.text('Amount Received:', 360, totalTop + 10);
    doc.text(`$${parseFloat(income.amount).toFixed(2)} CAD`, 460, totalTop + 10, { width: 90, align: 'right' });

    // Payment method info box
    const paymentTop = 440;
    doc.rect(50, paymentTop, 512, 80).stroke(primaryColor);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor);
    doc.text('PAYMENT DETAILS', 60, paymentTop + 12);

    doc.font('Helvetica').fontSize(10).fillColor(darkGray);
    const methodName = income.payment_method === 'etransfer' ? 'Interac e-Transfer' :
                       income.payment_method === 'cheque' ? 'Cheque' :
                       income.payment_method.charAt(0).toUpperCase() + income.payment_method.slice(1);
    doc.text(`Payment Method: ${methodName}`, 60, paymentTop + 35);

    if (income.reference) {
      doc.text(`Reference Number: ${income.reference}`, 60, paymentTop + 52);
    }

    // Confirmation stamp
    const stampTop = 550;
    doc.rect(180, stampTop, 250, 60).lineWidth(3).stroke(primaryColor);
    doc.font('Helvetica-Bold').fontSize(18).fillColor(primaryColor);
    doc.text('PAYMENT RECEIVED', 180, stampTop + 15, { width: 250, align: 'center' });
    doc.font('Helvetica').fontSize(10);
    doc.text('This receipt confirms payment in full', 180, stampTop + 40, { width: 250, align: 'center' });

    // Footer
    doc.rect(0, 730, 612, 60).fill('#f9fafb');
    doc.fillColor(lightGray).font('Helvetica').fontSize(9);
    doc.text('Thank you for your business!', 50, 745, { align: 'center', width: 512 });
    doc.text('Questions? Contact us at support@migslist.com', 50, 760, { align: 'center', width: 512 });

    doc.end();
  } catch (err) {
    console.error('Generate receipt PDF error:', err);
    req.session.error = 'Error generating receipt';
    res.redirect('/admin/finance/income');
  }
});

// ============================================
// REPORTS
// ============================================

// Reports page
router.get('/reports', async (req, res) => {
  try {
    const allIncome = await Income.findAll();
    const years = [...new Set(allIncome.map(i => new Date(i.received_date).getFullYear()))];

    const allExpenses = await Expense.findAll();
    const expenseYears = [...new Set(allExpenses.map(e => new Date(e.expense_date).getFullYear()))];

    const availableYears = [...new Set([...years, ...expenseYears])].sort((a, b) => b - a);

    // If no data yet, show current year
    if (availableYears.length === 0) {
      availableYears.push(new Date().getFullYear());
    }

    res.render('admin/finance/reports/annual', { availableYears, selectedYear: null, report: null });
  } catch (err) {
    console.error('Reports page error:', err);
    req.session.error = 'Error loading reports';
    res.redirect('/admin/finance');
  }
});

// Annual report for specific year
router.get('/reports/year/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);

    // Get income data
    const income = await Income.findByYear(year);
    const totalIncome = await Income.getTotalByYear(year);
    const monthlyIncome = await Income.getMonthlyTotals(year);

    // Get expense data
    const expenses = await Expense.findByYear(year);
    const totalExpenses = await Expense.getTotalByYear(year);
    const expensesByCategory = await Expense.getTotalsByCategory(year);
    const monthlyExpenses = await Expense.getMonthlyTotals(year);

    // Calculate net profit
    const netProfit = totalIncome - totalExpenses;

    // Get available years for navigation
    const allIncome = await Income.findAll();
    const allExpenses = await Expense.findAll();
    const incomeYears = allIncome.map(i => new Date(i.received_date).getFullYear());
    const expenseYears = allExpenses.map(e => new Date(e.expense_date).getFullYear());
    const availableYears = [...new Set([...incomeYears, ...expenseYears])].sort((a, b) => b - a);

    if (availableYears.length === 0) {
      availableYears.push(new Date().getFullYear());
    }

    const report = {
      year,
      income,
      totalIncome,
      monthlyIncome,
      expenses,
      totalExpenses,
      expensesByCategory,
      monthlyExpenses,
      netProfit
    };

    res.render('admin/finance/reports/annual', { availableYears, selectedYear: year, report });
  } catch (err) {
    console.error('Annual report error:', err);
    req.session.error = 'Error generating report';
    res.redirect('/admin/finance/reports');
  }
});

module.exports = router;
