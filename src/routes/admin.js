const express = require('express');
const router = express.Router();
const { requireSuperAdmin } = require('../middleware/auth');
const Union = require('../models/Union');
const User = require('../models/User');
const Bucket = require('../models/Bucket');

// Apply super admin middleware to all routes
router.use(requireSuperAdmin);

// Admin dashboard
router.get('/', async (req, res) => {
  try {
    const unions = await Union.findAll();
    const users = await User.findAll();

    const stats = {
      totalUnions: unions.length,
      totalUsers: users.length,
      totalBuckets: unions.reduce((sum, u) => sum + parseInt(u.bucket_count || 0), 0),
      totalMembers: unions.reduce((sum, u) => sum + parseInt(u.member_count || 0), 0)
    };

    res.render('admin/dashboard', { unions, users, stats });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    req.session.error = 'Error loading dashboard';
    res.render('admin/dashboard', { unions: [], users: [], stats: {} });
  }
});

// === UNIONS ===

// List unions
router.get('/unions', async (req, res) => {
  try {
    const unions = await Union.findAll();
    res.render('admin/unions/list', { unions });
  } catch (err) {
    console.error('List unions error:', err);
    req.session.error = 'Error loading unions';
    res.render('admin/unions/list', { unions: [] });
  }
});

// New union form
router.get('/unions/new', (req, res) => {
  res.render('admin/unions/edit', { union: null });
});

// Create union
router.post('/unions', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      req.session.error = 'Union name is required';
      return res.redirect('/admin/unions/new');
    }
    await Union.create({ name: name.trim() });
    req.session.success = 'Union created successfully';
    res.redirect('/admin/unions');
  } catch (err) {
    console.error('Create union error:', err);
    req.session.error = 'Error creating union';
    res.redirect('/admin/unions/new');
  }
});

// View union
router.get('/unions/:id', async (req, res) => {
  try {
    const union = await Union.findById(req.params.id);
    if (!union) {
      req.session.error = 'Union not found';
      return res.redirect('/admin/unions');
    }
    const buckets = await Bucket.findByUnionId(union.id);
    const users = await User.findByUnionId(union.id);
    const stats = await Union.getStats(union.id);
    res.render('admin/unions/view', { union, buckets, users, stats });
  } catch (err) {
    console.error('View union error:', err);
    req.session.error = 'Error loading union';
    res.redirect('/admin/unions');
  }
});

// Edit union form
router.get('/unions/:id/edit', async (req, res) => {
  try {
    const union = await Union.findById(req.params.id);
    if (!union) {
      req.session.error = 'Union not found';
      return res.redirect('/admin/unions');
    }
    res.render('admin/unions/edit', { union });
  } catch (err) {
    console.error('Edit union error:', err);
    req.session.error = 'Error loading union';
    res.redirect('/admin/unions');
  }
});

// Update union
router.post('/unions/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      req.session.error = 'Union name is required';
      return res.redirect(`/admin/unions/${req.params.id}/edit`);
    }
    await Union.update(req.params.id, { name: name.trim() });
    req.session.success = 'Union updated successfully';
    res.redirect('/admin/unions');
  } catch (err) {
    console.error('Update union error:', err);
    req.session.error = 'Error updating union';
    res.redirect(`/admin/unions/${req.params.id}/edit`);
  }
});

// Delete union
router.post('/unions/:id/delete', async (req, res) => {
  try {
    await Union.delete(req.params.id);
    req.session.success = 'Union deleted successfully';
    res.redirect('/admin/unions');
  } catch (err) {
    console.error('Delete union error:', err);
    req.session.error = 'Error deleting union';
    res.redirect('/admin/unions');
  }
});

// === USERS ===

// List users
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll();
    const unions = await Union.findAll();
    res.render('admin/users/list', { users, unions });
  } catch (err) {
    console.error('List users error:', err);
    req.session.error = 'Error loading users';
    res.render('admin/users/list', { users: [], unions: [] });
  }
});

// New user form
router.get('/users/new', async (req, res) => {
  try {
    const unions = await Union.findAll();
    res.render('admin/users/edit', { user: null, unions });
  } catch (err) {
    console.error('New user form error:', err);
    req.session.error = 'Error loading form';
    res.redirect('/admin/users');
  }
});

// Create user
router.post('/users', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, unionId } = req.body;

    if (!email || !password) {
      req.session.error = 'Email and password are required';
      return res.redirect('/admin/users/new');
    }

    if (password.length < 8) {
      req.session.error = 'Password must be at least 8 characters';
      return res.redirect('/admin/users/new');
    }

    if (role === 'union_admin' && !unionId) {
      req.session.error = 'Union admin must be assigned to a union';
      return res.redirect('/admin/users/new');
    }

    await User.create({
      email,
      password,
      firstName,
      lastName,
      role,
      unionId: role === 'super_admin' ? null : unionId
    });

    req.session.success = 'User created successfully';
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Create user error:', err);
    if (err.code === '23505') {
      req.session.error = 'Email already exists';
    } else {
      req.session.error = 'Error creating user';
    }
    res.redirect('/admin/users/new');
  }
});

// Edit user form
router.get('/users/:id/edit', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.session.error = 'User not found';
      return res.redirect('/admin/users');
    }
    const unions = await Union.findAll();
    res.render('admin/users/edit', { user, unions });
  } catch (err) {
    console.error('Edit user error:', err);
    req.session.error = 'Error loading user';
    res.redirect('/admin/users');
  }
});

// Update user
router.post('/users/:id', async (req, res) => {
  try {
    const { email, firstName, lastName, unionId } = req.body;

    if (!email) {
      req.session.error = 'Email is required';
      return res.redirect(`/admin/users/${req.params.id}/edit`);
    }

    await User.update(req.params.id, {
      email,
      firstName,
      lastName,
      unionId: unionId || null
    });

    req.session.success = 'User updated successfully';
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Update user error:', err);
    if (err.code === '23505') {
      req.session.error = 'Email already exists';
    } else {
      req.session.error = 'Error updating user';
    }
    res.redirect(`/admin/users/${req.params.id}/edit`);
  }
});

// Reset user password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      req.session.error = 'Password must be at least 8 characters';
      return res.redirect(`/admin/users/${req.params.id}/edit`);
    }
    await User.updatePassword(req.params.id, password);
    req.session.success = 'Password reset successfully';
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Reset password error:', err);
    req.session.error = 'Error resetting password';
    res.redirect('/admin/users');
  }
});

// Delete user
router.post('/users/:id/delete', async (req, res) => {
  try {
    if (req.params.id === req.session.userId) {
      req.session.error = 'Cannot delete your own account';
      return res.redirect('/admin/users');
    }
    await User.delete(req.params.id);
    req.session.success = 'User deleted successfully';
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Delete user error:', err);
    req.session.error = 'Error deleting user';
    res.redirect('/admin/users');
  }
});

module.exports = router;
