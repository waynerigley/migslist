const db = require('../config/db');

const Union = {
  async create(data) {
    const {
      name, contactEmail, contactName, contactPhone,
      status = 'pending', paymentStatus = 'unpaid'
    } = data;

    const result = await db.query(
      `INSERT INTO unions (name, contact_email, contact_name, contact_phone, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, contactEmail, contactName, contactPhone, status, paymentStatus]
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

  async findActive() {
    const result = await db.query(
      `SELECT u.*,
              COUNT(DISTINCT b.id) as bucket_count,
              COUNT(DISTINCT m.id) as member_count
       FROM unions u
       LEFT JOIN buckets b ON u.id = b.union_id
       LEFT JOIN members m ON b.id = m.bucket_id
       WHERE u.status = 'active'
       GROUP BY u.id
       ORDER BY u.name`
    );
    return result.rows;
  },

  async findPending() {
    const result = await db.query(
      `SELECT * FROM unions WHERE status = 'pending' ORDER BY created_at ASC`
    );
    return result.rows;
  },

  async update(id, data) {
    const { name, contactEmail, contactName, contactPhone } = data;
    const result = await db.query(
      `UPDATE unions SET name = $1, contact_email = $2, contact_name = $3, contact_phone = $4
       WHERE id = $5 RETURNING *`,
      [name, contactEmail, contactName, contactPhone, id]
    );
    return result.rows[0];
  },

  async activate(id, paymentReference) {
    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);

    const result = await db.query(
      `UPDATE unions SET
       status = 'active',
       payment_status = 'paid',
       subscription_start = $1,
       subscription_end = $2,
       payment_reference = $3,
       payment_date = NOW()
       WHERE id = $4 RETURNING *`,
      [subscriptionStart, subscriptionEnd, paymentReference, id]
    );
    return result.rows[0];
  },

  async deactivate(id) {
    const result = await db.query(
      `UPDATE unions SET status = 'expired', payment_status = 'expired' WHERE id = $1 RETURNING *`,
      [id]
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
  },

  async isActive(id) {
    const result = await db.query(
      `SELECT status, subscription_end FROM unions WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) return false;
    const union = result.rows[0];
    if (union.status !== 'active') return false;
    if (union.subscription_end && new Date(union.subscription_end) < new Date()) {
      // Subscription expired, update status
      await this.deactivate(id);
      return false;
    }
    return true;
  }
};

module.exports = Union;
