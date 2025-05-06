const jwt = require('jsonwebtoken');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Protect routes with JWT
exports.protect = async (req, res, next) => {
  let token;

  // Get token from header, cookie, or query param
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  } else if (req.query.token) {
    token = req.query.token;
  }

  // Make sure token exists
  if (!token) {

    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists

    console.log("decoded informations", decoded)
    const currentUser = await User.findById(decoded?.id);
    if (!currentUser) {
      return next(new ErrorResponse('The user belonging to this token no longer exists', 401));
    }

    // // Check if user changed password after token was issued
    // if (currentUser.changedPasswordAfter(decoded.iat)) {
    //   return next(new ErrorResponse('User recently changed password! Please log in again', 401));
    // }

    // Grant access to protected route
    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
};

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


// Role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

// CSRF protection for state-changing requests
exports.csrfProtection = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
    
  }
  next();
};

