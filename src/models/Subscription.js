const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  agent: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
    unique: true, // Each agent can only have one active subscription
  },
  plan: {
    type: String,
    enum: ["basic", "premium", "enterprise"],
    required: true,
  },
  planDetails: {
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number, // Duration in days
      required: true,
    },
    propertyLimit: {
      type: Number,
      required: true,
    },
    featuredListings: {
      type: Number,
      default: 0,
    },
    prioritySupport: {
      type: Boolean,
      default: false,
    },
  },
  status: {
    type: String,
    enum: ["active", "expired", "cancelled", "pending"],
    default: "pending",
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  propertiesPosted: {
    type: Number,
    default: 0,
  },
  featuredListingsUsed: {
    type: Number,
    default: 0,
  },
  paymentDetails: {
    transactionId: String,
    paymentMethod: String,
    amountPaid: Number,
    paidAt: Date,
  },
  autoRenewal: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
subscriptionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if subscription is active and not exceeded limits
subscriptionSchema.methods.canPostProperty = function () {
  const now = new Date();
  const isActive = this.status === "active" && this.endDate > now;
  const hasPostingLimit =
    this.propertiesPosted < this.planDetails.propertyLimit;

  return isActive && hasPostingLimit;
};

// Method to check if can create featured listing
subscriptionSchema.methods.canCreateFeaturedListing = function () {
  return this.featuredListingsUsed < this.planDetails.featuredListings;
};

// Method to increment properties posted count
subscriptionSchema.methods.incrementPropertiesPosted = async function () {
  this.propertiesPosted += 1;
  return await this.save();
};

// Method to increment featured listings used
subscriptionSchema.methods.incrementFeaturedListings = async function () {
  this.featuredListingsUsed += 1;
  return await this.save();
};

// Static method to get predefined subscription plans
subscriptionSchema.statics.getSubscriptionPlans = function () {
  return {
    basic: {
      name: "Basic Plan",
      price: 5000, // 50 NGN
      duration: 30, // 30 days
      propertyLimit: 10,
      featuredListings: 1,
      prioritySupport: false,
    },
    premium: {
      name: "Premium Plan",
      price: 15000, // 150 NGN
      duration: 30, // 30 days
      propertyLimit: 50,
      featuredListings: 5,
      prioritySupport: true,
    },
    enterprise: {
      name: "Enterprise Plan",
      price: 30000, // 300 NGN
      duration: 30, // 30 days
      propertyLimit: 200,
      featuredListings: 20,
      prioritySupport: true,
    },
  };
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
