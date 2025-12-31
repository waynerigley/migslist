const db = require('../config/db');

const Expense = {
  async create(data) {
    const { category, vendor, description, amount, currency, expenseDate, expiresAt, receiptFilename } = data;

    const result = await db.query(
      `INSERT INTO expenses (category, vendor, description, amount, currency, expense_date, expires_at, receipt_filename)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [category || 'other', vendor || null, description || null, amount, currency || 'CAD', expenseDate, expiresAt || null, receiptFilename || null]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM expenses WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await db.query(
      'SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC'
    );
    return result.rows;
  },

  async findByYear(year) {
    const result = await db.query(
      `SELECT * FROM expenses
       WHERE EXTRACT(YEAR FROM expense_date) = $1
       ORDER BY expense_date DESC`,
      [year]
    );
    return result.rows;
  },

  async findByCategory(category) {
    const result = await db.query(
      'SELECT * FROM expenses WHERE category = $1 ORDER BY expense_date DESC',
      [category]
    );
    return result.rows;
  },

  async findByDateRange(startDate, endDate) {
    const result = await db.query(
      `SELECT * FROM expenses
       WHERE expense_date >= $1 AND expense_date <= $2
       ORDER BY expense_date DESC`,
      [startDate, endDate]
    );
    return result.rows;
  },

  async update(id, data) {
    const { category, vendor, description, amount, currency, expenseDate, expiresAt, receiptFilename } = data;

    const result = await db.query(
      `UPDATE expenses
       SET category = $1, vendor = $2, description = $3, amount = $4, currency = $5, expense_date = $6, expires_at = $7, receipt_filename = $8
       WHERE id = $9
       RETURNING *`,
      [category, vendor || null, description || null, amount, currency || 'CAD', expenseDate, expiresAt || null, receiptFilename || null, id]
    );
    return result.rows[0];
  },

  async updateReceipt(id, filename) {
    const result = await db.query(
      'UPDATE expenses SET receipt_filename = $1 WHERE id = $2 RETURNING *',
      [filename, id]
    );
    return result.rows[0];
  },

  async removeReceipt(id) {
    const result = await db.query(
      'UPDATE expenses SET receipt_filename = NULL WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM expenses WHERE id = $1', [id]);
  },

  async getTotalByYear(year) {
    const result = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE EXTRACT(YEAR FROM expense_date) = $1`,
      [year]
    );
    return parseFloat(result.rows[0].total);
  },

  async getTotalByDateRange(startDate, endDate) {
    const result = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE expense_date >= $1 AND expense_date <= $2`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0].total);
  },

  async getTotalsByCategory(year) {
    const result = await db.query(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE EXTRACT(YEAR FROM expense_date) = $1
       GROUP BY category
       ORDER BY total DESC`,
      [year]
    );
    return result.rows;
  },

  async getMonthlyTotals(year) {
    const result = await db.query(
      `SELECT
         EXTRACT(MONTH FROM expense_date) as month,
         COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE EXTRACT(YEAR FROM expense_date) = $1
       GROUP BY EXTRACT(MONTH FROM expense_date)
       ORDER BY month`,
      [year]
    );
    return result.rows;
  },

  async getRecentTransactions(limit = 5) {
    const result = await db.query(
      `SELECT * FROM expenses
       ORDER BY expense_date DESC, created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async findExpiringSoon(days = 30) {
    const result = await db.query(
      `SELECT * FROM expenses
       WHERE expires_at IS NOT NULL
         AND expires_at <= CURRENT_DATE + $1
         AND expires_at >= CURRENT_DATE
       ORDER BY expires_at ASC`,
      [days]
    );
    return result.rows;
  },

  async findExpired() {
    const result = await db.query(
      `SELECT * FROM expenses
       WHERE expires_at IS NOT NULL
         AND expires_at < CURRENT_DATE
       ORDER BY expires_at DESC`
    );
    return result.rows;
  },

  // Valid categories
  getCategories() {
    return [
      { value: 'server', label: 'Server/Hosting' },
      { value: 'domain', label: 'Domain/DNS' },
      { value: 'software', label: 'Software/Subscriptions' },
      { value: 'office', label: 'Office Supplies' },
      { value: 'marketing', label: 'Marketing/Advertising' },
      { value: 'professional', label: 'Professional Services' },
      { value: 'banking', label: 'Banking/Fees' },
      { value: 'other', label: 'Other' }
    ];
  },

  // Common vendors
  getVendors() {
    return [
      'Vultr',
      'Hostinger',
      'Cloudflare',
      'Ontario Business Service',
      'Google',
      'Microsoft',
      'Amazon AWS',
      'DigitalOcean',
      'Namecheap',
      'GoDaddy',
      'Brevo',
      'SendGrid'
    ];
  }
};

module.exports = Expense;
