const responseTime = require('response-time');

exports.performanceMonitor = responseTime((req, res, time) => {
  if (time > 500) { // Log slow requests (>500ms)
    logger.warn(`Slow request: ${req.method} ${req.originalUrl} took ${time.toFixed(2)}ms`);
  }
});