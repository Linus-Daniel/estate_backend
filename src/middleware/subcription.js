const Subscription = require("../models/Subscription");
const ErrorResponse = require("../utils/errorResponse");

// Middleware to check if agent has active subscription
exports.checkActiveSubscription = async (req, res, next) => {
  try {
    // Only check for agents
    if (req.user.role !== "agent") {
      return next();
    }

    const subscription = await Subscription.findOne({
      agent: req.user.id,
      status: "active",
      endDate: { $gt: new Date() },
    });

    if (!subscription) {
      return next(
        new ErrorResponse(
          "You need an active subscription to perform this action",
          403
        )
      );
    }

    // Add subscription to request for use in controllers
    req.subscription = subscription;
    next();
  } catch (err) {
    next(err);
  }
};

// Middleware to check property posting limits
exports.checkPropertyPostingLimit = async (req, res, next) => {
  try {
    if (req.user.role !== "agent") {
      return next();
    }

    const subscription =
      req.subscription ||
      (await Subscription.findOne({
        agent: req.user.id,
        status: "active",
        endDate: { $gt: new Date() },
      }));

    if (!subscription) {
      return next(
        new ErrorResponse(
          "You need an active subscription to post properties",
          403
        )
      );
    }

    if (!subscription.canPostProperty()) {
      return next(
        new ErrorResponse(
          "You have reached your subscription limit for property postings",
          403
        )
      );
    }

    req.subscription = subscription;
    next();
  } catch (err) {
    next(err);
  }
};

// Middleware to check featured listing limits
exports.checkFeaturedListingLimit = async (req, res, next) => {
  try {
    if (req.user.role !== "agent") {
      return next();
    }

    const subscription =
      req.subscription ||
      (await Subscription.findOne({
        agent: req.user.id,
        status: "active",
        endDate: { $gt: new Date() },
      }));

    if (!subscription) {
      return next(
        new ErrorResponse(
          "You need an active subscription to create featured listings",
          403
        )
      );
    }

    if (!subscription.canCreateFeaturedListing()) {
      return next(
        new ErrorResponse("You have reached your featured listings limit", 403)
      );
    }

    req.subscription = subscription;
    next();
  } catch (err) {
    next(err);
  }
};

// Cron job function to handle subscription expiry and auto-renewal
exports.handleSubscriptionExpiry = async () => {
  try {
    const now = new Date();

    // Find expired subscriptions
    const expiredSubscriptions = await Subscription.find({
      status: "active",
      endDate: { $lte: now },
    });

    for (const subscription of expiredSubscriptions) {
      if (subscription.autoRenewal) {
        // Handle auto-renewal logic here
        // You might want to charge the user's saved payment method
        console.log(
          `Auto-renewing subscription for agent: ${subscription.agent}`
        );
        // Implementation would depend on your payment processing setup
      } else {
        // Mark as expired
        subscription.status = "expired";
        await subscription.save();
        console.log(`Subscription expired for agent: ${subscription.agent}`);
      }
    }

    // Clean up very old expired subscriptions (optional)
    const oldExpiredDate = new Date();
    oldExpiredDate.setMonth(oldExpiredDate.getMonth() - 6); // 6 months ago

    await Subscription.deleteMany({
      status: "expired",
      endDate: { $lte: oldExpiredDate },
    });
  } catch (error) {
    console.error("Error handling subscription expiry:", error);
  }
};

// Export cron job for use in your main app file
exports.scheduleSubscriptionCleanup = () => {
  // Run every hour
  setInterval(exports.handleSubscriptionExpiry, 60 * 60 * 1000);

  // You can also use a more sophisticated cron job library like node-cron:
  // const cron = require('node-cron');
  // cron.schedule('0 * * * *', exports.handleSubscriptionExpiry); // Every hour
};
