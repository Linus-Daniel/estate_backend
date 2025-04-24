class ErrorResponse extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true; // Distinguish operational errors
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  module.exports = ErrorResponse;