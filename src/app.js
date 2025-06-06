require('dotenv').config(); // Loads env vars from .env

const jwt = require('jsonwebtoken');

const express = require('express');
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
  corsMiddleware, // <- renamed to avoid confusion
} = require('./middleware/security');

const { protect, authorize} = require('./middleware/auth');
const { performanceMonitor } = require('./middleware/performance');
const { requestLogger } = require('./middleware/logger');
const errorHandler = require('./middleware/error');
const connectDB = require('./config/db');

// Connect to database
connectDB();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const blogRoutes = require('./routes/blogRoutes');
const chatRoutes = require('./routes/chatRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoute');


// Initialize app
const app = express();

// Parse JSON requests
app.use(express.json({ limit: '10kb' }));

// Security middlewares
app.use(corsMiddleware);        // Correct CORS usage
app.use(securityHeaders);
app.use(limiter);
app.use(cookieParser());
// app.use(csrf({ cookie: true }));
app.use(sanitizeData);
app.use(xssClean);
app.use(hpp);

// Performance monitoring and request logging
app.use(performanceMonitor);
app.use(requestLogger);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', protect, authorize('admin'), userRoutes);
app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/blogs', blogRoutes);
app.use('/api/v1/chats', protect, chatRoutes);
app.use('/api/v1/upload', uploadRoutes, )
app.use('/api/v1/payments', protect,  paymentRoutes);
app.get("/api/v1/csrf-token", (req, res) => {
  res.cookie("XSRF-TOKEN", req.csrfToken(), {
    httpOnly: false, // frontend needs to read it
    secure: true,
    sameSite: "None",
  });
  res.json({ csrfToken: req.csrfToken() });
});
exports.authenticateSocket = async (socket) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      throw new Error('Authentication token missing')
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    return true;
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
};

app.set('trust proxy', 1); // Trust first proxy (Render)




app.use((req, res, next) => {
  console.log('Incoming Request Headers:', req.headers);
  next();
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.log('CSRF Error:', req.headers, req.cookies);
  }
  next(err);
});
// Error handling
app.use(errorHandler);

module.exports = app;
