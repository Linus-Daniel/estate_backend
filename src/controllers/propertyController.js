const geocoder = require("../utils/geocoder");
const Property = require("../models/Property");
const Subscription = require("../models/Subscription");
const ErrorResponse = require("../utils/errorResponse");

// Helper function to check agent subscription
const checkAgentSubscription = async (agentId) => {
  const subscription = await Subscription.findOne({
    agent: agentId,
    status: "active",
    endDate: { $gt: new Date() },
  });

  if (!subscription) {
    throw new ErrorResponse(
      "You need an active subscription to post properties",
      403
    );
  }

  if (!subscription.canPostProperty()) {
    throw new ErrorResponse(
      "You have reached your subscription limit for property postings",
      403
    );
  }

  return subscription;
};

exports.getProperties = async (req, res, next) => {
  try {
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit"];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Finding resource
    query = Property.find(JSON.parse(queryStr)).populate({
      path: "agent",
      select: "name email phone",
    });

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort - Featured properties first, then by creation date
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-isFeatured -createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Property.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const properties = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: properties.length,
      pagination,
      total,
      data: properties,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single property
// @route   GET /api/v1/properties/:id
// @access  Public
exports.getProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate({
        path: "agent",
        select: "name email phone bio photo",
      })
      .populate({
        path: "subscriptionUsed",
        select: "plan planDetails",
      });

    if (!property) {
      return next(
        new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: property,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new property
// @route   POST /api/v1/properties
// @access  Private (agent only)
exports.createProperty = async (req, res, next) => {
  try {
    // Check if user is an agent
    if (req.user.role !== "agent") {
      return next(new ErrorResponse("Only agents can post properties", 403));
    }

    // Check agent's subscription
    const subscription = await checkAgentSubscription(req.user.id);

    // Add agent and subscription to req.body
    req.body.agent = req.user.id;
    req.body.subscriptionUsed = subscription._id;

    // Set posting order
    req.body.postingOrder = subscription.propertiesPosted + 1;

    // Create property
    const property = await Property.create(req.body);

    // Increment subscription's properties posted count
    await subscription.incrementPropertiesPosted();

    // Populate agent details for response
    await property.populate("agent", "name email phone");

    res.status(201).json({
      success: true,
      data: property,
      subscription: {
        propertiesRemaining:
          subscription.planDetails.propertyLimit -
          (subscription.propertiesPosted + 1),
        featuredListingsRemaining:
          subscription.planDetails.featuredListings -
          subscription.featuredListingsUsed,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update property
// @route   PUT /api/v1/properties/:id
// @access  Private (agent, admin)
exports.updateProperty = async (req, res, next) => {
  try {
    let property = await Property.findById(req.params.id);

    if (!property) {
      return next(
        new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is property agent or admin
    if (
      property.agent.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new ErrorResponse(
          `User ${req.user.id} is not authorized to update this property`,
          401
        )
      );
    }

    // Prevent updating subscription-related fields directly
    delete req.body.subscriptionUsed;
    delete req.body.postingOrder;

    property = await Property.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("agent", "name email phone");

    res.status(200).json({
      success: true,
      data: property,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete property
// @route   DELETE /api/v1/properties/:id
// @access  Private (agent, admin)
exports.deleteProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return next(
        new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is property agent or admin
    if (
      property.agent.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new ErrorResponse(
          `User ${req.user.id} is not authorized to delete this property`,
          401
        )
      );
    }

    // Delete the property
    await Property.findByIdAndDelete(req.params.id);

    // Note: We don't decrement the subscription count as the agent has already "used" that slot

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Make property featured
// @route   PUT /api/v1/properties/:id/feature
// @access  Private (agent only)
exports.makePropertyFeatured = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return next(
        new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is property agent
    if (property.agent.toString() !== req.user.id) {
      return next(
        new ErrorResponse(
          `User ${req.user.id} is not authorized to feature this property`,
          401
        )
      );
    }

    // Check if property is already featured and active
    if (property.isFeaturedActive()) {
      return next(new ErrorResponse("Property is already featured", 400));
    }

    // Check agent's subscription and featured listing limits
    const subscription = await Subscription.findOne({
      agent: req.user.id,
      status: "active",
      endDate: { $gt: new Date() },
    });

    if (!subscription) {
      return next(
        new ErrorResponse(
          "You need an active subscription to feature properties",
          403
        )
      );
    }

    if (!subscription.canCreateFeaturedListing()) {
      return next(
        new ErrorResponse("You have reached your featured listings limit", 403)
      );
    }

    // Make property featured
    const { durationDays = 30 } = req.body;
    await property.makeFeatured(durationDays);

    // Increment subscription's featured listings used
    await subscription.incrementFeaturedListings();

    res.status(200).json({
      success: true,
      data: property,
      subscription: {
        featuredListingsRemaining:
          subscription.planDetails.featuredListings -
          (subscription.featuredListingsUsed + 1),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get featured properties
// @route   GET /api/v1/properties/featured
// @access  Public
exports.getFeaturedProperties = async (req, res, next) => {
  try {
    const properties = await Property.getFeaturedProperties();

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get agent's properties with subscription info
// @route   GET /api/v1/properties/my-properties
// @access  Private (agent only)
exports.getMyProperties = async (req, res, next) => {
  try {
    if (req.user.role !== "agent") {
      return next(
        new ErrorResponse("Only agents can view their properties", 403)
      );
    }

    // Get agent's subscription info
    const subscription = await Subscription.findOne({
      agent: req.user.id,
      status: "active",
    });

    // Get agent's properties
    const properties = await Property.find({ agent: req.user.id })
      .populate("subscriptionUsed", "plan planDetails")
      .sort("-createdAt");

    // Calculate subscription usage
    const subscriptionInfo = subscription
      ? {
          plan: subscription.plan,
          planDetails: subscription.planDetails,
          propertiesPosted: subscription.propertiesPosted,
          featuredListingsUsed: subscription.featuredListingsUsed,
          remainingProperties:
            subscription.planDetails.propertyLimit -
            subscription.propertiesPosted,
          remainingFeaturedListings:
            subscription.planDetails.featuredListings -
            subscription.featuredListingsUsed,
          endDate: subscription.endDate,
          canPostMore: subscription.canPostProperty(),
          canCreateFeatured: subscription.canCreateFeaturedListing(),
        }
      : null;

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties,
      subscription: subscriptionInfo,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get properties within a radius
// @route   GET /api/v1/properties/radius/:zipcode/:distance
// @access  Public
exports.getPropertiesInRadius = async (req, res, next) => {
  try {
    const { zipcode, distance } = req.params;

    // Get lat/lng from geocoder
    const loc = await geocoder.geocode(zipcode);
    const lat = loc[0].latitude;
    const lng = loc[0].longitude;

    // Calc radius using radians
    // Divide dist by radius of Earth
    // Earth Radius = 3,963 mi / 6,378 km
    const radius = distance / 3963;

    const properties = await Property.find({
      location: {
        $geoWithin: { $centerSphere: [[lng, lat], radius] },
      },
    })
      .populate("agent", "name email phone")
      .sort("-isFeatured -createdAt");

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload photo for property
// @route   PUT /api/v1/properties/:id/photo
// @access  Private (agent, admin)
exports.propertyPhotoUpload = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return next(
        new ErrorResponse(`Property not found with id of ${req.params.id}`, 404)
      );
    }

    // Make sure user is property agent or admin
    if (
      property.agent.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new ErrorResponse(
          `User ${req.user.id} is not authorized to update this property`,
          401
        )
      );
    }

    if (!req.files) {
      return next(new ErrorResponse(`Please upload a file`, 400));
    }

    const file = req.files.file;

    // Make sure the image is a photo
    if (!file.mimetype.startsWith("image")) {
      return next(new ErrorResponse(`Please upload an image file`, 400));
    }

    // Check filesize
    if (file.size > process.env.MAX_FILE_UPLOAD) {
      return next(
        new ErrorResponse(
          `Please upload an image less than ${process.env.MAX_FILE_UPLOAD}`,
          400
        )
      );
    }

    // Create custom filename
    file.name = `photo_${property._id}${path.parse(file.name).ext}`;

    file.mv(`${process.env.FILE_UPLOAD_PATH}/${file.name}`, async (err) => {
      if (err) {
        console.error(err);
        return next(new ErrorResponse(`Problem with file upload`, 500));
      }

      await Property.findByIdAndUpdate(req.params.id, { photo: file.name });

      res.status(200).json({
        success: true,
        data: file.name,
      });
    });
  } catch (err) {
    next(err);
  }
};
