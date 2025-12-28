const express = require('express');
const router = express.Router();
const { requireUnionAdmin } = require('../middleware/auth');
const Bucket = require('../models/Bucket');
const Member = require('../models/Member');

router.use(requireUnionAdmin);

// Helper to check bucket ownership
async function checkBucketAccess(req, res, next) {
  try {
    const bucket = await Bucket.findById(req.params.id);
    if (!bucket) {
      req.session.error = 'Bucket not found';
      return res.redirect('/dashboard');
    }

    // Super admins can access any bucket
    if (req.session.role === 'super_admin') {
      req.bucket = bucket;
      return next();
    }

    // Union admins can only access their union's buckets
    if (bucket.union_id !== req.session.unionId) {
      req.session.error = 'Access denied';
      return res.redirect('/dashboard');
    }

    req.bucket = bucket;
    next();
  } catch (err) {
    console.error('Bucket access check error:', err);
    req.session.error = 'Error accessing bucket';
    res.redirect('/dashboard');
  }
}

// New bucket form
router.get('/new', (req, res) => {
  res.render('buckets/edit', { bucket: null });
});

// Create bucket
router.post('/', async (req, res) => {
  try {
    const { number, name } = req.body;
    const unionId = req.session.unionId;

    if (!unionId) {
      req.session.error = 'No union context';
      return res.redirect('/dashboard');
    }

    if (!number || !name) {
      req.session.error = 'Bucket number and name are required';
      return res.redirect('/buckets/new');
    }

    await Bucket.create({ unionId, number: number.trim(), name: name.trim() });
    req.session.success = 'Bucket created successfully';
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Create bucket error:', err);
    if (err.code === '23505') {
      req.session.error = 'A bucket with this number already exists';
    } else {
      req.session.error = 'Error creating bucket';
    }
    res.redirect('/buckets/new');
  }
});

// View bucket (list members)
router.get('/:id', checkBucketAccess, async (req, res) => {
  try {
    const members = await Member.findByBucketId(req.params.id);
    res.render('buckets/view', { bucket: req.bucket, members });
  } catch (err) {
    console.error('View bucket error:', err);
    req.session.error = 'Error loading bucket';
    res.redirect('/dashboard');
  }
});

// Edit bucket form
router.get('/:id/edit', checkBucketAccess, async (req, res) => {
  const members = await Member.findByBucketId(req.params.id);
  res.render('buckets/edit', { bucket: req.bucket, memberCount: members.length });
});

// Update bucket
router.post('/:id', checkBucketAccess, async (req, res) => {
  try {
    const { number, name } = req.body;

    if (!number || !name) {
      req.session.error = 'Bucket number and name are required';
      return res.redirect(`/buckets/${req.params.id}/edit`);
    }

    await Bucket.update(req.params.id, { number: number.trim(), name: name.trim() });
    req.session.success = 'Bucket updated successfully';
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Update bucket error:', err);
    if (err.code === '23505') {
      req.session.error = 'A bucket with this number already exists';
    } else {
      req.session.error = 'Error updating bucket';
    }
    res.redirect(`/buckets/${req.params.id}/edit`);
  }
});

// Delete bucket
router.post('/:id/delete', checkBucketAccess, async (req, res) => {
  try {
    await Bucket.delete(req.params.id);
    req.session.success = 'Bucket deleted successfully';
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Delete bucket error:', err);
    req.session.error = 'Error deleting bucket';
    res.redirect('/dashboard');
  }
});

module.exports = router;
