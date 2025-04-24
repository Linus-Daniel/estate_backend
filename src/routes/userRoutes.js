const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  uploadUserPhoto,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router
  .route('/')
  .get(getUsers)
  .post(createUser);

router
  .route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

  router.route('/:id/photo')
  .put(upload.single('photo'), handleUploadErrors, uploadUserPhoto);

module.exports = router;