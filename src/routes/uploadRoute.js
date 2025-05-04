const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');
const { uploadFile } = require('../controllers/uploadController');

const router = express.Router();

// Dynamically set the field name and limit
router.post(
  '/',
  protect,
  (req, res, next) => {
    // Determine dynamic field name from the request (e.g., field name could come from req.body)
    const fieldName = req.body.fieldName || 'image'; // Default to 'image' if no field name is specified
    const fileLimit = req.body.fileLimit || 10; // Default to 10 files if no limit is provided

    // Dynamically update the upload middleware to use the dynamic field name
    upload.array(fieldName, fileLimit)(req, res, next); // Use the field name and file limit dynamically
  },
  handleUploadErrors,
  uploadFile
);

module.exports = router;
