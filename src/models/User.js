const db = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

const User = {
  async create({ email, password, firstName, lastName, role, unionId }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, union_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, union_id, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, role, unionId]
    );
    return result.rows[0];
  },

  async findByEmail(email) {
    const result = await db.query(
      `SELECT u.*, un.name as union_name
       FROM users u
       LEFT JOIN unions un ON u.union_id = un.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT u.*, un.name as union_name
       FROM users u
       LEFT JOIN unions un ON u.union_id = un.id
       WHERE u.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  },

  async updatePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, userId]
    );
  },

  async generateResetToken(email) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [token, expires, user.id]
    );

    return { user, token };
  },

  async findByResetToken(token) {
    const result = await db.query(
      `SELECT * FROM users
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
    return result.rows[0];
  },

  async findByUnionId(unionId) {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, created_at
       FROM users
       WHERE union_id = $1
       ORDER BY created_at DESC`,
      [unionId]
    );
    return result.rows;
  },

  async findAll() {
    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.union_id, u.created_at, un.name as union_name
       FROM users u
       LEFT JOIN unions un ON u.union_id = un.id
       ORDER BY u.created_at DESC`
    );
    return result.rows;
  },

  async update(id, { email, firstName, lastName, unionId }) {
    const result = await db.query(
      `UPDATE users
       SET email = $1, first_name = $2, last_name = $3, union_id = $4
       WHERE id = $5
       RETURNING id, email, first_name, last_name, role, union_id`,
      [email.toLowerCase(), firstName, lastName, unionId, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
  }
};

module.exports = User;
