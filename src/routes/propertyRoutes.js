const express = require('express');
const {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertiesInRadius,
  propertyPhotoUpload,
} = require('../controllers/propertyController');
const { protect, authorize } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');

// Import chat controller
const { initiatePropertyChat } = require('../controllers/chatController');

const router = express.Router();

// Property routes
router.route('/radius/:zipcode/:distance').get(getPropertiesInRadius);

router
  .route('/')
  .get(getProperties)
  .post(protect, authorize('agent', 'admin'), createProperty);

router
  .route('/:id')
  .get(getProperty)
  .put(protect, authorize('agent', 'admin'), updateProperty)
  .delete(protect, authorize('agent', 'admin'), deleteProperty);

router
  .route('/:id/photo')
  .put(
    protect,
    authorize('agent', 'admin'),
    upload.single('photo'),
    handleUploadErrors,
    propertyPhotoUpload
  );

// Add chat initiation route to properties
router.route('/:propertyId/chat')
  .post(protect, initiatePropertyChat);

module.exports = router;