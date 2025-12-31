require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const db = require('./config/db');
const { addUserToLocals } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Cloudflare)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://img.youtube.com"],
      connectSrc: ["'self'", "https://cloudflareinsights.com"],
    },
  },
}));

// Rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts. Please try again after 15 minutes.'
});

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Add user to all views
app.use(addUserToLocals);

// Flash messages (simple implementation)
app.use((req, res, next) => {
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const signupRoutes = require('./routes/signup');
const adminRoutes = require('./routes/admin');
const financeRoutes = require('./routes/finance');
const dashboardRoutes = require('./routes/dashboard');
const bucketsRoutes = require('./routes/buckets');
const membersRoutes = require('./routes/members');
const exportRoutes = require('./routes/export');
const teamRoutes = require('./routes/team');

app.use('/', authRoutes);
app.use('/', signupRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/finance', financeRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/buckets', bucketsRoutes);
app.use('/members', membersRoutes);
app.use('/export', exportRoutes);
app.use('/team', teamRoutes);

// Apply rate limiter to login route
app.use('/login', loginLimiter);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Page not found'
  });
});

app.listen(PORT, () => {
  console.log(`MigsList running on http://localhost:${PORT}`);
});
