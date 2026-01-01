#!/usr/bin/env node
/**
 * Cleanup orphaned database records
 * Run: node cleanup-orphans.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function cleanup() {
  console.log('=== Database Cleanup ===\n');

  // First, show current state
  const buckets = await pool.query('SELECT COUNT(*) as count FROM buckets');
  const deletedBuckets = await pool.query('SELECT COUNT(*) as count FROM buckets WHERE deleted_at IS NOT NULL');
  const members = await pool.query('SELECT COUNT(*) as count FROM members');
  const orphanedMembers = await pool.query(`
    SELECT COUNT(*) as count FROM members m
    WHERE NOT EXISTS (SELECT 1 FROM buckets b WHERE b.id = m.bucket_id AND b.deleted_at IS NULL)
  `);

  console.log('Current state:');
  console.log('  Total buckets:', buckets.rows[0].count);
  console.log('  Soft-deleted buckets:', deletedBuckets.rows[0].count);
  console.log('  Total members:', members.rows[0].count);
  console.log('  Orphaned members (in deleted/missing buckets):', orphanedMembers.rows[0].count);
  console.log('');

  // Delete orphaned members
  const deletedMembersResult = await pool.query(`
    DELETE FROM members m
    WHERE NOT EXISTS (SELECT 1 FROM buckets b WHERE b.id = m.bucket_id AND b.deleted_at IS NULL)
    RETURNING id
  `);
  console.log('Deleted orphaned members:', deletedMembersResult.rowCount);

  // Delete soft-deleted buckets permanently
  const deletedBucketsResult = await pool.query(`
    DELETE FROM buckets WHERE deleted_at IS NOT NULL RETURNING id
  `);
  console.log('Deleted soft-deleted buckets:', deletedBucketsResult.rowCount);

  // Delete orphaned buckets (no union)
  const orphanBucketsResult = await pool.query(`
    DELETE FROM buckets b
    WHERE NOT EXISTS (SELECT 1 FROM unions u WHERE u.id = b.union_id)
    RETURNING id
  `);
  console.log('Deleted orphaned buckets (no union):', orphanBucketsResult.rowCount);

  // Show new state
  const newBuckets = await pool.query('SELECT COUNT(*) as count FROM buckets');
  const newMembers = await pool.query('SELECT COUNT(*) as count FROM members');

  console.log('\nNew state:');
  console.log('  Total buckets:', newBuckets.rows[0].count);
  console.log('  Total members:', newMembers.rows[0].count);

  await pool.end();
  console.log('\n=== Cleanup Complete ===');
}

cleanup().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
