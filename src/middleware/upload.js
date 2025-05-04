const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const ErrorResponse = require('../utils/errorResponse');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    let folder;
    if (file.fieldname === 'photo') {
      folder = 'real-estate/properties';
    } else if (file.fieldname === 'avatar') {
      folder = 'real-estate/users';
    } else if (file.fieldname === 'image') {
      folder = 'real-estate/blogs';
    } else {
      folder = 'real-estate/misc';
    }
    
    return {
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
      transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
      public_id: `${file.fieldname}-${Date.now()}`
    };
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new ErrorResponse('Please upload an image file', 400), false);
  }
};

// Create and export the Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: process.env.MAX_FILE_UPLOAD || 3000000 // 1MB default
  }
});

// Export the upload middleware and error handler
module.exports = {
  upload,
  handleUploadErrors: (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return next(new ErrorResponse(`File upload error: ${err.message}`, 400));
    } else if (err) {
      return next(new ErrorResponse(err.message, 400));
    }
    next();
  }
};