const db = require('../config/db');

const Bucket = {
  async create({ unionId, number, name }) {
    const result = await db.query(
      `INSERT INTO buckets (union_id, number, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [unionId, number, name]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT b.*, u.name as union_name
       FROM buckets b
       JOIN unions u ON b.union_id = u.id
       WHERE b.id = $1 AND b.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0];
  },

  async findByUnionId(unionId) {
    const result = await db.query(
      `SELECT b.*,
              COUNT(m.id) as member_count,
              COUNT(CASE WHEN m.pdf_filename IS NOT NULL THEN 1 END) as good_standing_count
       FROM buckets b
       LEFT JOIN members m ON b.id = m.bucket_id
       WHERE b.union_id = $1 AND b.deleted_at IS NULL
       GROUP BY b.id
       ORDER BY b.number`,
      [unionId]
    );
    return result.rows;
  },

  async update(id, { number, name }) {
    const result = await db.query(
      `UPDATE buckets SET number = $1, name = $2 WHERE id = $3 RETURNING *`,
      [number, name, id]
    );
    return result.rows[0];
  },

  async updateMasterPdf(id, filename) {
    const result = await db.query(
      `UPDATE buckets SET master_pdf_filename = $1 WHERE id = $2 RETURNING *`,
      [filename, id]
    );
    return result.rows[0];
  },

  async removeMasterPdf(id) {
    const result = await db.query(
      `UPDATE buckets SET master_pdf_filename = NULL WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  // Soft delete - just marks as deleted
  async delete(id) {
    await db.query('UPDATE buckets SET deleted_at = NOW() WHERE id = $1', [id]);
  },

  // Hard delete - actually removes from database (for admin use)
  async hardDelete(id) {
    await db.query('DELETE FROM buckets WHERE id = $1', [id]);
  },

  // Restore a soft-deleted bucket
  async restore(id) {
    const result = await db.query(
      'UPDATE buckets SET deleted_at = NULL WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  // Find deleted buckets (for admin recovery)
  async findDeleted(unionId) {
    const result = await db.query(
      `SELECT b.*,
              COUNT(m.id) as member_count
       FROM buckets b
       LEFT JOIN members m ON b.id = m.bucket_id
       WHERE b.union_id = $1 AND b.deleted_at IS NOT NULL
       GROUP BY b.id
       ORDER BY b.deleted_at DESC`,
      [unionId]
    );
    return result.rows;
  },

  async belongsToUnion(bucketId, unionId) {
    const result = await db.query(
      'SELECT id FROM buckets WHERE id = $1 AND union_id = $2',
      [bucketId, unionId]
    );
    return result.rows.length > 0;
  }
};

module.exports = Bucket;
