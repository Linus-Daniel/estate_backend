// controllers/uploadController.js
const ErrorResponse = require('../utils/errorResponse');

// @desc    Upload file
// @route   POST /api/v1/upload
// @access  Private
exports.uploadFile = async (req, res, next) => {
  console.log(req)
  try {
    if (!req.file) {
      return next(new ErrorResponse('Please upload a file', 400));
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        public_id: req.file.filename
      }
    });
  } catch (err) {
    console.log("error Encouuntered",err)
    next(err);
  }
};