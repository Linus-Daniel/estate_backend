// controllers/uploadController.js
const ErrorResponse = require('../utils/errorResponse');

// @desc    Upload file(s)
// @route   POST /api/v1/upload
// @access  Private
exports.uploadFile = async (req, res, next) => {
  try {
    let uploadedFiles = [];

    // For single file (e.g., multer.single())
    if (req.file) {
      uploadedFiles.push({
        url: req.file.path,
        public_id: req.file.filename
      });
      console.log('Single file uploaded:', uploadedFiles); // Log for single file
    }

    // For multiple files (e.g., multer.array())
    else if (Array.isArray(req.files)) {
      uploadedFiles = req.files.map((file) => ({
        url: file.path,
        public_id: file.filename
      }));
      console.log('Multiple files uploaded:', uploadedFiles); // Log for multiple files
    }

    // For multiple fields (e.g., multer.fields())
    else if (typeof req.files === 'object' && req.files !== null) {
      Object.keys(req.files).forEach((field) => {
        req.files[field].forEach((file) => {
          uploadedFiles.push({
            url: file.path,
            public_id: file.filename
          });
        });
      });
      console.log('Multiple fields uploaded:', uploadedFiles); // Log for multiple fields
    }

    // If no file(s) uploaded
    if (uploadedFiles.length === 0) {
      return next(new ErrorResponse('Please upload at least one file', 400));
    }

    // Log the successful upload response
    console.log('Files successfully uploaded:', uploadedFiles);

    // Respond with uploaded data
    res.status(200).json({
      success: true,
      data: uploadedFiles
    });

  } catch (err) {
    console.log("Error encountered during upload:", err);
    next(err);
  }
};
