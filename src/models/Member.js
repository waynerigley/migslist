const db = require('../config/db');

const Member = {
  async create(data) {
    const {
      bucketId, firstName, lastName, email, phone,
      addressLine1, addressLine2, city, state, zip
    } = data;

    const result = await db.query(
      `INSERT INTO members
       (bucket_id, first_name, last_name, email, phone, address_line1, address_line2, city, state, zip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [bucketId, firstName, lastName, email || null, phone || null,
       addressLine1 || null, addressLine2 || null, city || null, state || null, zip || null]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT m.*, b.name as bucket_name, b.number as bucket_number, b.union_id
       FROM members m
       JOIN buckets b ON m.bucket_id = b.id
       WHERE m.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByBucketId(bucketId) {
    const result = await db.query(
      `SELECT * FROM members WHERE bucket_id = $1 AND retired_at IS NULL ORDER BY last_name, first_name`,
      [bucketId]
    );
    return result.rows;
  },

  async findGoodStandingByBucketId(bucketId) {
    const result = await db.query(
      `SELECT * FROM members
       WHERE bucket_id = $1 AND pdf_filename IS NOT NULL AND retired_at IS NULL
       ORDER BY last_name, first_name`,
      [bucketId]
    );
    return result.rows;
  },

  async findRetiredByBucketId(bucketId) {
    const result = await db.query(
      `SELECT * FROM members WHERE bucket_id = $1 AND retired_at IS NOT NULL ORDER BY retired_at DESC`,
      [bucketId]
    );
    return result.rows;
  },

  async retire(id, reason) {
    const result = await db.query(
      `UPDATE members SET retired_at = NOW(), retired_reason = $1 WHERE id = $2 RETURNING *`,
      [reason || 'Retired', id]
    );
    return result.rows[0];
  },

  async restore(id) {
    const result = await db.query(
      `UPDATE members SET retired_at = NULL, retired_reason = NULL WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const {
      firstName, lastName, email, phone,
      addressLine1, addressLine2, city, state, zip
    } = data;

    const result = await db.query(
      `UPDATE members SET
       first_name = $1, last_name = $2, email = $3, phone = $4,
       address_line1 = $5, address_line2 = $6, city = $7, state = $8, zip = $9
       WHERE id = $10
       RETURNING *`,
      [firstName, lastName, email || null, phone || null,
       addressLine1 || null, addressLine2 || null, city || null, state || null, zip || null, id]
    );
    return result.rows[0];
  },

  async updatePdf(id, filename) {
    const result = await db.query(
      `UPDATE members SET pdf_filename = $1, pdf_uploaded_at = NOW() WHERE id = $2 RETURNING *`,
      [filename, id]
    );
    return result.rows[0];
  },

  async removePdf(id) {
    const result = await db.query(
      `UPDATE members SET pdf_filename = NULL, pdf_uploaded_at = NULL WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const member = await this.findById(id);
    await db.query('DELETE FROM members WHERE id = $1', [id]);
    return member;
  },

  async search(unionId, query) {
    const result = await db.query(
      `SELECT m.*, b.name as bucket_name, b.number as bucket_number
       FROM members m
       JOIN buckets b ON m.bucket_id = b.id
       WHERE b.union_id = $1
         AND m.retired_at IS NULL
         AND (m.first_name ILIKE $2 OR m.last_name ILIKE $2 OR m.email ILIKE $2)
       ORDER BY m.last_name, m.first_name
       LIMIT 50`,
      [unionId, `%${query}%`]
    );
    return result.rows;
  },

  async findAllByUnionId(unionId) {
    const result = await db.query(
      `SELECT m.*, b.name as bucket_name, b.number as bucket_number
       FROM members m
       JOIN buckets b ON m.bucket_id = b.id
       WHERE b.union_id = $1
         AND m.retired_at IS NULL
         AND b.deleted_at IS NULL
       ORDER BY b.number, m.last_name, m.first_name`,
      [unionId]
    );
    return result.rows;
  }
};

module.exports = Member;
