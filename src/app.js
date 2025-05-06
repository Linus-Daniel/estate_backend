require('dotenv').config(); // Load env vars from .env

const express = require('express');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const path = require('path');

// Import middleware
const {
  securityHeaders,
  limiter,
  sanitizeData,
  xssClean,
  hpp,
  corsMiddleware,
} = require('./middleware/security');

const { protect, authorize, csrfProtection } = require('./middleware/auth');
const { performanceMonitor } = require('./middleware/performance');
const { requestLogger } = require('./middleware/logger');
const errorHandler = require('./middleware/error');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const blogRoutes = require('./routes/blogRoutes');
const chatRoutes = require('./routes/chatRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoute');

// Connect to database
connectDB();

// Initialize app
const app = express();

// Trust Render proxy
app.set('trust proxy', 1);

// Middleware: JSON parsing
app.use(express.json({ limit: '10kb' }));

// Middleware: Security
app.use(corsMiddleware);
app.use(securityHeaders);
app.use(limiter);
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: 'none',
    httpOnly: true,
  },
  proxy: true,
}));
app.use(csrf({ cookie: true }));
app.use(sanitizeData);
app.use(xssClean);
app.use(hpp);

// Middleware: Monitoring & Logging
app.use(performanceMonitor);
app.use(requestLogger);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Log all incoming request headers (debugging)
app.use((req, res, next) => {
  console.log('Incoming Request Headers:', req.headers);
  next();
});

// CSRF error logger
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF Error:', req.headers, req.cookies);
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  next(err);
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', protect, authorize('admin'), userRoutes);
app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/blogs', blogRoutes);
app.use('/api/v1/chats', protect, chatRoutes);
app.use('/api/v1/upload', uploadRoutes); // apply csrfProtection inside route file if needed
app.use('/api/v1/payments', protect, paymentRoutes);

// Endpoint to get CSRF token
app.get("/api/v1/csrf-token", (req, res) => {
  const token = req.csrfToken();
  res.cookie("XSRF-TOKEN", token, {
    httpOnly: false,
    secure: true,
    sameSite: "None",
  });
  res.json({ csrfToken: token });
});

// WebSocket auth export
exports.authenticateSocket = async (socket) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) throw new Error('Authentication token missing');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    return true;
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
};

// Global error handler
app.use(errorHandler);

module.exports = app;
