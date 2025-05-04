// routes/uploadRoutes.js
const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');
const { uploadFile } = require('../controllers/uploadController');

const router = express.Router();

router.post(
  '/',
  protect,
  upload.single('file'),
  handleUploadErrors,
  uploadFile
);

module.exports = router;