const Blog = require('../models/Blog');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all blogs
// @route   GET /api/v1/blogs
// @access  Public
exports.getBlogs = async (req, res, next) => {
  try {
    const blogs = await Blog.find({ isPublished: true }).populate({
      path: 'author',
      select: 'name email photo',
    });

    res.status(200).json({
      success: true,
      count: blogs.length,
      data: blogs,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single blog
// @route   GET /api/v1/blogs/:id
// @access  Public
exports.getBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id).populate({
      path: 'author',
      select: 'name email photo',
    });

    if (!blog) {
      return next(
        new ErrorResponse(`Blog not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new blog
// @route   POST /api/v1/blogs
// @access  Private (agent, admin)
exports.createBlog = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.author = req.user.id;

    const blog = await Blog.create(req.body);

    res.status(201).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update blog
// @route   PUT /api/v1/blogs/:id
// @access  Private (agent, admin)
exports.updateBlog = async (req, res, next) => {
  try {
    let blog = await Blog.findById(req.params.id);

    if (!blog) {
      return next(
        new ErrorResponse(`Blog not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is blog author or admin
    if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(
        new ErrorResponse(
          `User ${req.user.id} is not authorized to update this blog`,
          401
        )
      );
    }

    blog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete blog
// @route   DELETE /api/v1/blogs/:id
// @access  Private (agent, admin)
exports.deleteBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return next(
        new ErrorResponse(`Blog not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is blog author or admin
    if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(
        new ErrorResponse(
          `User ${req.user.id} is not authorized to delete this blog`,
          401
        )
      );
    }

    await blog.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Publish blog
// @route   PUT /api/v1/blogs/:id/publish
// @access  Private (agent, admin)
exports.publishBlog = async (req, res, next) => {
  try {
    let blog = await Blog.findById(req.params.id);

    if (!blog) {
      return next(
        new ErrorResponse(`Blog not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is blog author or admin
    if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(
        new ErrorResponse(
          `User ${req.user.id} is not authorized to publish this blog`,
          401
        )
      );
    }

    blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { isPublished: true, publishedAt: Date.now() },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    next(err);
  }
};