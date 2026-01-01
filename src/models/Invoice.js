const db = require('../config/db');

const Invoice = {
  async create(data) {
    const { unionId, amount, issueDate, dueDate, notes, includeAddress } = data;

    // Generate invoice number: INV-YYYY-NNN
    const invoiceNumber = await this.generateInvoiceNumber();

    const result = await db.query(
      `INSERT INTO invoices (invoice_number, union_id, amount, issue_date, due_date, notes, include_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [invoiceNumber, unionId, amount, issueDate, dueDate, notes || null, includeAddress || false]
    );
    return result.rows[0];
  },

  async generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Get the highest invoice number for this year
    const result = await db.query(
      `SELECT invoice_number FROM invoices
       WHERE invoice_number LIKE $1
       ORDER BY invoice_number DESC
       LIMIT 1`,
      [prefix + '%']
    );

    let nextNumber = 1;
    if (result.rows.length > 0) {
      const lastNumber = parseInt(result.rows[0].invoice_number.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  },

  async findById(id) {
    const result = await db.query(
      `SELECT i.*, u.name as union_name, u.contact_email, u.contact_name, u.contact_phone
       FROM invoices i
       LEFT JOIN unions u ON i.union_id = u.id
       WHERE i.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByInvoiceNumber(invoiceNumber) {
    const result = await db.query(
      `SELECT i.*, u.name as union_name, u.contact_email, u.contact_name, u.contact_phone
       FROM invoices i
       LEFT JOIN unions u ON i.union_id = u.id
       WHERE i.invoice_number = $1`,
      [invoiceNumber]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await db.query(
      `SELECT i.*, u.name as union_name
       FROM invoices i
       LEFT JOIN unions u ON i.union_id = u.id
       ORDER BY i.issue_date DESC, i.created_at DESC`
    );
    return result.rows;
  },

  async findByStatus(status) {
    const result = await db.query(
      `SELECT i.*, u.name as union_name
       FROM invoices i
       LEFT JOIN unions u ON i.union_id = u.id
       WHERE i.status = $1
       ORDER BY i.issue_date DESC`,
      [status]
    );
    return result.rows;
  },

  async findByYear(year) {
    const result = await db.query(
      `SELECT i.*, u.name as union_name
       FROM invoices i
       LEFT JOIN unions u ON i.union_id = u.id
       WHERE EXTRACT(YEAR FROM i.issue_date) = $1
       ORDER BY i.issue_date DESC`,
      [year]
    );
    return result.rows;
  },

  async findByUnion(unionId) {
    const result = await db.query(
      `SELECT * FROM invoices
       WHERE union_id = $1
       ORDER BY issue_date DESC`,
      [unionId]
    );
    return result.rows;
  },

  async findOutstanding() {
    const result = await db.query(
      `SELECT i.*, u.name as union_name
       FROM invoices i
       LEFT JOIN unions u ON i.union_id = u.id
       WHERE i.status IN ('sent', 'overdue')
       ORDER BY i.due_date ASC`
    );
    return result.rows;
  },

  async update(id, data) {
    const { unionId, amount, issueDate, dueDate, status, notes, includeAddress } = data;

    const result = await db.query(
      `UPDATE invoices
       SET union_id = $1, amount = $2, issue_date = $3, due_date = $4, status = $5, notes = $6, include_address = $7
       WHERE id = $8
       RETURNING *`,
      [unionId, amount, issueDate, dueDate, status, notes || null, includeAddress || false, id]
    );
    return result.rows[0];
  },

  async markSent(id) {
    const result = await db.query(
      `UPDATE invoices SET status = 'sent' WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async markPaid(id, paidDate = null) {
    const result = await db.query(
      `UPDATE invoices SET status = 'paid', paid_date = $1 WHERE id = $2 RETURNING *`,
      [paidDate || new Date(), id]
    );
    return result.rows[0];
  },

  async markOverdue(id) {
    const result = await db.query(
      `UPDATE invoices SET status = 'overdue' WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM invoices WHERE id = $1', [id]);
  },

  async getTotalByYear(year) {
    const result = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM invoices
       WHERE EXTRACT(YEAR FROM issue_date) = $1 AND status = 'paid'`,
      [year]
    );
    return parseFloat(result.rows[0].total);
  },

  async getOutstandingTotal() {
    const result = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM invoices
       WHERE status IN ('sent', 'overdue')`
    );
    return parseFloat(result.rows[0].total);
  },

  async getStats() {
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
         COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
         COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
         COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count,
         COALESCE(SUM(amount) FILTER (WHERE status IN ('sent', 'overdue')), 0) as outstanding_total
       FROM invoices`
    );
    return result.rows[0];
  },

  // Check for overdue invoices and update their status
  async updateOverdueInvoices() {
    const result = await db.query(
      `UPDATE invoices
       SET status = 'overdue'
       WHERE status = 'sent' AND due_date < CURRENT_DATE
       RETURNING *`
    );
    return result.rows;
  }
};

module.exports = Invoice;
