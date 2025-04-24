const { check, validationResult } = require('express-validator');
const ErrorResponse = require('../utils/errorResponse');

// Common validation rules
exports.validate = (method) => {
  switch (method) {
    case 'register':
      return [
        check('name', 'Name is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
      ];
    case 'login':
      return [
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Password is required').exists()
      ];
    case 'property':
      return [
        check('title', 'Title is required').not().isEmpty(),
        check('description', 'Description is required').not().isEmpty(),
        check('price', 'Price is required').isNumeric(),
        check('address', 'Address is required').not().isEmpty()
      ];
    case 'blog':
      return [
        check('title', 'Title is required').not().isEmpty().isLength({ max: 100 }),
        check('content', 'Content is required').not().isEmpty(),
        check('excerpt', 'Excerpt is required').not().isEmpty().isLength({ max: 200 })
      ];
    case 'message':
      return [
        check('content', 'Message content is required').not().isEmpty()
      ];
  }
};

// Handle validation errors
exports.validationHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map(err => err.msg).join('. ');
    return next(new ErrorResponse(message, 400));
  }
  next();
};