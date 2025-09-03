const Subscription = require("../models/Subscription");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const paystack = require("paystack")(process.env.PAYSTACK_SECRET_KEY);

// @desc    Get all subscription plans
// @route   GET /api/v1/subscriptions/plans
// @access  Public
exports.getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = Subscription.getSubscriptionPlans();

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get agent's current subscription
// @route   GET /api/v1/subscriptions/my-subscription
// @access  Private (agent only)
exports.getMySubscription = async (req, res, next) => {
  try {
    // Check if user is an agent
    if (req.user.role !== "agent") {
      return next(new ErrorResponse("Only agents can have subscriptions", 403));
    }

    const subscription = await Subscription.findOne({ agent: req.user.id });

    if (!subscription) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No active subscription found",
      });
    }

    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Subscribe to a plan
// @route   POST /api/v1/subscriptions/subscribe
// @access  Private (agent only)
exports.subscribeToPlan = async (req, res, next) => {
  try {
    const { planType, autoRenewal = false } = req.body;

    // Check if user is an agent
    if (req.user.role !== "agent") {
      return next(new ErrorResponse("Only agents can subscribe to plans", 403));
    }

    // Check if agent already has an active subscription
    const existingSubscription = await Subscription.findOne({
      agent: req.user.id,
      status: { $in: ["active", "pending"] },
    });

    if (existingSubscription) {
      return next(
        new ErrorResponse(
          "You already have an active or pending subscription",
          400
        )
      );
    }

    // Get plan details
    const plans = Subscription.getSubscriptionPlans();
    const selectedPlan = plans[planType];

    if (!selectedPlan) {
      return next(new ErrorResponse("Invalid subscription plan", 400));

    }

    console.log("Selected Plan:", selectedPlan);
    console.log("User Info:", req.user);
    console.log("Initializing subscription procedures")

  
    const amountInKobo = selectedPlan.price * 100;
    const paymentPayload = {
      email: req.user.email,
      amount: amountInKobo,
      currency: "NGN",
      metadata: {
        userId: req.user.id,
        planType,
        subscriptionType: "subscription",
      },
      callback_url:"http://localhost:3000/pricing/success",
    };

    const payment = await paystack.transaction.initialize(paymentPayload);

    if (!payment || !payment.data || !payment.data.reference) {
      return next(new ErrorResponse("Failed to initialize payment", 500));
    }

    // Create subscription record
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + selectedPlan.duration);

    const subscription = await Subscription.create({
      agent: req.user.id,
      plan: planType,
      planDetails: selectedPlan,
      endDate,
      autoRenewal,
      paymentDetails: {
        transactionId: payment.data.reference,
        paymentMethod: "paystack",
        amountPaid: selectedPlan.price,
      },
      status: "pending",
    });

    res.status(201).json({
      success: true,
      data: {
        subscription,
        authorizationUrl: payment.data.authorization_url,
        reference: payment.data.reference,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify subscription payment
// @route   POST /api/v1/subscriptions/verify-payment
// @access  Private (agent only)
exports.verifySubscriptionPayment = async (req, res, next) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return next(new ErrorResponse("Payment reference is required", 400));
    }

    // Verify payment with Paystack
    const response = await paystack.transaction.verify(reference);

    if (!response || !response.data) {
      return next(new ErrorResponse("Payment verification failed", 400));
    }

    // Find subscription by transaction ID
    const subscription = await Subscription.findOne({
      "paymentDetails.transactionId": reference,
    });

    if (!subscription) {
      return next(new ErrorResponse("Subscription not found", 404));
    }

    if (subscription.status === "active") {
      return res.status(200).json({
        success: true,
        message: "Subscription already activated",
        data: subscription,
      });
    }

    // Update subscription based on payment status
    if (response.data.status === "success") {
      subscription.status = "active";
      subscription.startDate = new Date();
      subscription.paymentDetails.paidAt = response.data.paid_at || new Date();
      subscription.paymentDetails.amountPaid = response.data.amount / 100; // Convert from kobo

      await subscription.save();

      return res.status(200).json({
        success: true,
        message: "Subscription activated successfully",
        data: subscription,
      });
    }

    // Handle failed payment
    subscription.status = "cancelled";
    await subscription.save();

    return res.status(400).json({
      success: false,
      message: "Payment verification failed",
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel subscription
// @route   PUT /api/v1/subscriptions/cancel
// @access  Private (agent only)
exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      agent: req.user.id,
      status: "active",
    });

    if (!subscription) {
      return next(new ErrorResponse("No active subscription found", 404));
    }

    subscription.status = "cancelled";
    subscription.autoRenewal = false;
    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get subscription usage statistics
// @route   GET /api/v1/subscriptions/usage
// @access  Private (agent only)
exports.getSubscriptionUsage = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      agent: req.user.id,
      status: "active",
    });

    if (!subscription) {
      return next(new ErrorResponse("No active subscription found", 404));
    }

    const usageStats = {
      propertiesPosted: subscription.propertiesPosted,
      propertyLimit: subscription.planDetails.propertyLimit,
      remainingProperties:
        subscription.planDetails.propertyLimit - subscription.propertiesPosted,
      featuredListingsUsed: subscription.featuredListingsUsed,
      featuredListingsLimit: subscription.planDetails.featuredListings,
      remainingFeaturedListings:
        subscription.planDetails.featuredListings -
        subscription.featuredListingsUsed,
      subscriptionEndDate: subscription.endDate,
      daysRemaining: Math.ceil(
        (subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)
      ),
      canPostProperty: subscription.canPostProperty(),
      canCreateFeaturedListing: subscription.canCreateFeaturedListing(),
    };

    res.status(200).json({
      success: true,
      data: usageStats,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Renew subscription
// @route   POST /api/v1/subscriptions/renew
// @access  Private (agent only)
exports.renewSubscription = async (req, res, next) => {
  try {
    const { planType } = req.body;

    const subscription = await Subscription.findOne({ agent: req.user.id });

    if (!subscription) {
      return next(new ErrorResponse("No subscription found", 404));
    }

    // Use existing plan if no new plan specified
    const selectedPlanType = planType || subscription.plan;
    const plans = Subscription.getSubscriptionPlans();
    const selectedPlan = plans[selectedPlanType];

    if (!selectedPlan) {
      return next(new ErrorResponse("Invalid subscription plan", 400));
    }

    // Initialize payment for renewal
    const amountInKobo = selectedPlan.price * 100;
    const paymentPayload = {
      email: req.user.email,
      amount: amountInKobo,
      currency: "NGN",
      metadata: {
        userId: req.user.id,
        planType: selectedPlanType,
        subscriptionType: "renewal",
      },
    };

    const payment = await paystack.transaction.initialize(paymentPayload);

    if (!payment || !payment.data) {
      return next(
        new ErrorResponse("Failed to initialize renewal payment", 500)
      );
    }

    res.status(200).json({
      success: true,
      data: {
        authorizationUrl: payment.data.authorization_url,
        reference: payment.data.reference,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all subscriptions (Admin only)
// @route   GET /api/v1/subscriptions/all
// @access  Private (admin only)
exports.getAllSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find()
      .populate("agent", "name email phone")
      .sort("-createdAt");

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions,
    });
  } catch (err) {
    next(err);
  }
};
