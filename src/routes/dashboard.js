const express = require('express');
const router = express.Router();
const { requireUnionAdmin } = require('../middleware/auth');
const Union = require('../models/Union');
const Bucket = require('../models/Bucket');
const Member = require('../models/Member');

// Apply auth middleware to all routes
router.use(requireUnionAdmin);

// Dashboard
router.get('/', async (req, res) => {
  try {
    // Super admins don't have a union, redirect to admin
    if (req.session.role === 'super_admin') {
      return res.redirect('/admin');
    }

    const unionId = req.session.unionId;
    const union = await Union.findById(unionId);
    const buckets = await Bucket.findByUnionId(unionId);
    const stats = await Union.getStats(unionId);

    res.render('dashboard/index', { union, buckets, stats });
  } catch (err) {
    console.error('Dashboard error:', err);
    req.session.error = 'Error loading dashboard';
    res.render('dashboard/index', { union: null, buckets: [], stats: {} });
  }
});

// Search members
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.render('dashboard/search', { members: [], query: q || '' });
    }

    const unionId = req.session.role === 'super_admin' ? null : req.session.unionId;

    if (!unionId) {
      req.session.error = 'Search requires a union context';
      return res.redirect('/admin');
    }

    const members = await Member.search(unionId, q);
    res.render('dashboard/search', { members, query: q });
  } catch (err) {
    console.error('Search error:', err);
    req.session.error = 'Error searching members';
    res.render('dashboard/search', { members: [], query: '' });
  }
});

module.exports = router;
