// middleware/security.js
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const corsMiddleware = cors({
  origin: process.env.FRONTEND_URL || '*', // Better: use specific origin in prod
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['Content-Disposition'],
});

const securityHeaders = helmet();

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});

const sanitizeData = mongoSanitize();
const xssClean = xss();
const hppMiddleware = hpp();

module.exports = {
  corsMiddleware,
  securityHeaders,
  limiter,
  sanitizeData,
  xssClean,
  hpp: hppMiddleware,
};
