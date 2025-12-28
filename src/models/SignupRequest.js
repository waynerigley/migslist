const db = require('../config/db');

const SignupRequest = {
  async create(data) {
    const {
      unionName, contactName, contactEmail, contactPhone,
      adminEmail, adminFirstName, adminLastName
    } = data;

    const result = await db.query(
      `INSERT INTO signup_requests
       (union_name, contact_name, contact_email, contact_phone, admin_email, admin_first_name, admin_last_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [unionName, contactName, contactEmail.toLowerCase(), contactPhone || null,
       adminEmail.toLowerCase(), adminFirstName || null, adminLastName || null]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM signup_requests WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await db.query(
      'SELECT * FROM signup_requests ORDER BY created_at DESC'
    );
    return result.rows;
  },

  async findPending() {
    const result = await db.query(
      `SELECT * FROM signup_requests WHERE status = 'pending' ORDER BY created_at ASC`
    );
    return result.rows;
  },

  async approve(id) {
    const result = await db.query(
      `UPDATE signup_requests SET status = 'approved', processed_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async reject(id, notes) {
    const result = await db.query(
      `UPDATE signup_requests SET status = 'rejected', notes = $1, processed_at = NOW() WHERE id = $2 RETURNING *`,
      [notes, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM signup_requests WHERE id = $1', [id]);
  }
};

module.exports = SignupRequest;
