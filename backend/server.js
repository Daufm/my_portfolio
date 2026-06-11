require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const authRoutes     = require('./routes/auth');
const blogRoutes     = require('./routes/blogs');
const projectRoutes  = require('./routes/projects');
const writeupsRoutes = require('./routes/writeups');
const contactRoutes  = require('./routes/contact');

const app  = express();
const PORT = process.env.PORT || 5000;

// ═══════════════════════════════════════════════
//  SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: false, // frontend handles its own CSP
  crossOriginEmbedderPolicy: false,
}));

// CORS — allow configured origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Global rate limiter — 100 req / 15 min
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '100'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests — slow down.' },
});
app.use(globalLimiter);

// Strict limiter for auth endpoints — 10 req / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

// Strict limiter for contact — 5 per hour
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Message limit reached. Try again in an hour.' },
});

// ═══════════════════════════════════════════════
//  BODY PARSING
// ═══════════════════════════════════════════════
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ═══════════════════════════════════════════════
//  LOGGING
// ═══════════════════════════════════════════════
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ═══════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'Fuad Portfolio API',
    env:     process.env.NODE_ENV,
    time:    new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════
app.use('/api/auth',     authLimiter,    authRoutes);
app.use('/api/blogs',                    blogRoutes);
app.use('/api/projects',                 projectRoutes);
app.use('/api/writeups',                 writeupsRoutes);
app.use('/api/contact',  contactLimiter, contactRoutes);

// ─── API root info ───────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({
    success: true,
    message: 'Fuad Mohammed Umer — Portfolio API',
    version: '1.0.0',
    endpoints: {
      auth:     ['POST /api/auth/login', 'GET /api/auth/me', 'POST /api/auth/change-password'],
      blogs:    ['GET /api/blogs', 'GET /api/blogs/:slug', 'POST /api/blogs *', 'PATCH /api/blogs/:id *', 'DELETE /api/blogs/:id *'],
      projects: ['GET /api/projects', 'GET /api/projects/:id', 'POST /api/projects *', 'PATCH /api/projects/:id *', 'DELETE /api/projects/:id *'],
      writeups: ['GET /api/writeups', 'GET /api/writeups/:id', 'POST /api/writeups *', 'PATCH /api/writeups/:id *', 'DELETE /api/writeups/:id *'],
      contact:  ['POST /api/contact', 'GET /api/contact *', 'PATCH /api/contact/:id *'],
    },
    note: '* = requires Bearer token (admin)',
  });
});

// ═══════════════════════════════════════════════
//  404 HANDLER
// ═══════════════════════════════════════════════
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// ═══════════════════════════════════════════════
//  GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('❌ Unhandled error:', err.message);

  if (err.message?.startsWith('CORS blocked')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ═══════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('  ███████╗██╗   ██╗ █████╗ ██████╗      █████╗ ██████╗ ██╗');
  console.log('  ██╔════╝██║   ██║██╔══██╗██╔══██╗    ██╔══██╗██╔══██╗██║');
  console.log('  █████╗  ██║   ██║███████║██║  ██║    ███████║██████╔╝██║');
  console.log('  ██╔══╝  ██║   ██║██╔══██║██║  ██║    ██╔══██║██╔═══╝ ██║');
  console.log('  ██║     ╚██████╔╝██║  ██║██████╔╝    ██║  ██║██║     ██║');
  console.log('  ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═════╝     ╚═╝  ╚═╝╚═╝     ╚═╝');
  console.log('');
  console.log(`  🚀  Server running on http://localhost:${PORT}`);
  console.log(`  🌍  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  🏥  Health check: http://localhost:${PORT}/health`);
  console.log(`  📡  API root    : http://localhost:${PORT}/api`);
  console.log('');
});

module.exports = app;
