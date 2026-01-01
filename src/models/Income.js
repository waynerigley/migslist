const db = require('../config/db');

const Income = {
  async create(data) {
    const { unionId, amount, paymentMethod, reference, description, receivedDate } = data;

    const result = await db.query(
      `INSERT INTO income (union_id, amount, payment_method, reference, description, received_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [unionId || null, amount, paymentMethod || 'etransfer', reference || null, description || null, receivedDate]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT i.*, u.name as union_name, u.contact_name, u.contact_email, u.contact_phone
       FROM income i
       LEFT JOIN unions u ON i.union_id = u.id
       WHERE i.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await db.query(
      `SELECT i.*, u.name as union_name
       FROM income i
       LEFT JOIN unions u ON i.union_id = u.id
       ORDER BY i.received_date DESC, i.created_at DESC`
    );
    return result.rows;
  },

  async findByYear(year) {
    const result = await db.query(
      `SELECT i.*, u.name as union_name
       FROM income i
       LEFT JOIN unions u ON i.union_id = u.id
       WHERE EXTRACT(YEAR FROM i.received_date) = $1
       ORDER BY i.received_date DESC`,
      [year]
    );
    return result.rows;
  },

  async findByDateRange(startDate, endDate) {
    const result = await db.query(
      `SELECT i.*, u.name as union_name
       FROM income i
       LEFT JOIN unions u ON i.union_id = u.id
       WHERE i.received_date >= $1 AND i.received_date <= $2
       ORDER BY i.received_date DESC`,
      [startDate, endDate]
    );
    return result.rows;
  },

  async update(id, data) {
    const { unionId, amount, paymentMethod, reference, description, receivedDate } = data;

    const result = await db.query(
      `UPDATE income
       SET union_id = $1, amount = $2, payment_method = $3, reference = $4, description = $5, received_date = $6
       WHERE id = $7
       RETURNING *`,
      [unionId || null, amount, paymentMethod, reference || null, description || null, receivedDate, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM income WHERE id = $1', [id]);
  },

  async getTotalByYear(year) {
    const result = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM income
       WHERE EXTRACT(YEAR FROM received_date) = $1`,
      [year]
    );
    return parseFloat(result.rows[0].total);
  },

  async getTotalByDateRange(startDate, endDate) {
    const result = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM income
       WHERE received_date >= $1 AND received_date <= $2`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0].total);
  },

  async getMonthlyTotals(year) {
    const result = await db.query(
      `SELECT
         EXTRACT(MONTH FROM received_date) as month,
         COALESCE(SUM(amount), 0) as total
       FROM income
       WHERE EXTRACT(YEAR FROM received_date) = $1
       GROUP BY EXTRACT(MONTH FROM received_date)
       ORDER BY month`,
      [year]
    );
    return result.rows;
  },

  async getRecentTransactions(limit = 5) {
    const result = await db.query(
      `SELECT i.*, u.name as union_name
       FROM income i
       LEFT JOIN unions u ON i.union_id = u.id
       ORDER BY i.received_date DESC, i.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
};

module.exports = Income;
