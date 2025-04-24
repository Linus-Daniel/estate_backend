const express = require('express');
const {
  getBlogs,
  getBlog,
  createBlog,
  updateBlog,
  deleteBlog,
  publishBlog,
} = require('../controllers/blogController');
const { protect, authorize } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');


const router = express.Router();

router
  .route('/')
  .get(getBlogs)
  .post(protect, authorize('agent', 'admin'), upload.single('image'), createBlog);

router
  .route('/:id')
  .get(getBlog)
  .put(protect, authorize('agent', 'admin'), updateBlog)
  .delete(protect, authorize('agent', 'admin'), deleteBlog);

router
  .route('/:id/publish')
  .put(protect, authorize('agent', 'admin'), publishBlog);

module.exports = router;