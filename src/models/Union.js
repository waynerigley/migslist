const db = require('../config/db');

const Union = {
  async create({ name }) {
    const result = await db.query(
      `INSERT INTO unions (name)
       VALUES ($1)
       RETURNING *`,
      [name]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM unions WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await db.query(
      `SELECT u.*,
              COUNT(DISTINCT b.id) as bucket_count,
              COUNT(DISTINCT m.id) as member_count
       FROM unions u
       LEFT JOIN buckets b ON u.id = b.union_id
       LEFT JOIN members m ON b.id = m.bucket_id
       GROUP BY u.id
       ORDER BY u.name`
    );
    return result.rows;
  },

  async update(id, { name }) {
    const result = await db.query(
      `UPDATE unions SET name = $1 WHERE id = $2 RETURNING *`,
      [name, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM unions WHERE id = $1', [id]);
  },

  async getStats(id) {
    const result = await db.query(
      `SELECT
        COUNT(DISTINCT b.id) as bucket_count,
        COUNT(DISTINCT m.id) as total_members,
        COUNT(DISTINCT CASE WHEN m.pdf_filename IS NOT NULL THEN m.id END) as good_standing_count
       FROM unions u
       LEFT JOIN buckets b ON u.id = b.union_id
       LEFT JOIN members m ON b.id = m.bucket_id
       WHERE u.id = $1`,
      [id]
    );
    return result.rows[0];
  }
};

module.exports = Union;
