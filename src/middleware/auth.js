// Authentication middleware

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.role !== 'super_admin') {
    return res.status(403).render('error', {
      message: 'Access denied. Super admin privileges required.'
    });
  }
  next();
}

// Allows president, secretary, or super_admin
function requireUnionAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  const allowedRoles = ['union_president', 'union_secretary', 'super_admin'];
  if (!allowedRoles.includes(req.session.role)) {
    return res.status(403).render('error', {
      message: 'Access denied.'
    });
  }
  next();
}

// Only president or super_admin (for managing users, deleting buckets)
function requireUnionPresident(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.role !== 'union_president' && req.session.role !== 'super_admin') {
    return res.status(403).render('error', {
      message: 'Access denied. President privileges required.'
    });
  }
  next();
}

function guestOnly(req, res, next) {
  if (req.session.userId) {
    if (req.session.role === 'super_admin') {
      return res.redirect('/admin');
    }
    return res.redirect('/dashboard');
  }
  next();
}

// Add user info to all views
function addUserToLocals(req, res, next) {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    email: req.session.email,
    firstName: req.session.firstName,
    lastName: req.session.lastName,
    role: req.session.role,
    unionId: req.session.unionId,
    unionName: req.session.unionName
  } : null;
  res.locals.isAuthenticated = !!req.session.userId;
  res.locals.isSuperAdmin = req.session.role === 'super_admin';
  res.locals.isPresident = req.session.role === 'union_president' || req.session.role === 'super_admin';
  res.locals.isSecretary = req.session.role === 'union_secretary';
  next();
}

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requireUnionAdmin,
  requireUnionPresident,
  guestOnly,
  addUserToLocals
};
