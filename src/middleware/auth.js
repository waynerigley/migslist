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

function requireUnionAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.role !== 'union_admin' && req.session.role !== 'super_admin') {
    return res.status(403).render('error', {
      message: 'Access denied.'
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
  next();
}

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requireUnionAdmin,
  guestOnly,
  addUserToLocals
};
