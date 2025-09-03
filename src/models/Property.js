const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please add a title"],
    trim: true,
  },
  description: {
    type: String,
    required: [true, "Please add a description"],
  },
  price: {
    type: Number,
    required: [true, "Please add a price"],
  },
  address: {
    type: String,
    required: [true, "Please add an address"],
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: [Number],
      index: "2dsphere",
    },
    formattedAddress: String,
    street: String,
    city: String,
    state: String,
    zipcode: String,
    country: String,
  },
  type: {
    type: String,
    enum: ["apartment", "house", "condo", "land"],
    required: true,
  },
  status: {
    type: String,
    enum: ["rent", "sale", "sold", "rented"],
    required: true,
  },
  bedrooms: {
    type: Number,
    required: true,
  },
  bathrooms: {
    type: Number,
    required: true,
  },
  area: {
    type: Number,
    required: true,
  },
  amenities: [String],
  images: [
    {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
  ],
  agent: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  // New subscription-related fields
  isFeatured: {
    type: Boolean,
    default: false,
  },
  featuredExpiry: {
    type: Date,
  },
  subscriptionUsed: {
    type: mongoose.Schema.ObjectId,
    ref: "Subscription",
    required: true, // Every property must be posted under a subscription
  },
  postingOrder: {
    type: Number, // For tracking order within subscription limit
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save middleware for geocoding
propertySchema.pre("save", async function (next) {
  // Skip if location already exists or address hasn't changed
  if (
    this.location &&
    this.location.coordinates &&
    this.location.coordinates[0] !== 0
  ) {
    return next();
  }

  // You would typically use a geocoding service here
  // For simplicity, we'll just set some basic fields
  this.location = {
    type: "Point",
    coordinates: [0, 0], // Replace with actual coordinates from geocoding service
    formattedAddress: this.address,
    street: this.address.split(",")[0],
    city: this.address.split(",")[1],
    state: this.address.split(",")[2],
    zipcode: this.address.split(",")[3],
    country: this.address.split(",")[4] || "Nigeria",
  };

  // Do not save address in DB
  this.address = undefined;
  next();
});

// Method to check if property is currently featured
propertySchema.methods.isFeaturedActive = function () {
  if (!this.isFeatured || !this.featuredExpiry) return false;
  return new Date() < this.featuredExpiry;
};

// Method to make property featured
propertySchema.methods.makeFeatured = function (durationDays = 30) {
  this.isFeatured = true;
  this.featuredExpiry = new Date(
    Date.now() + durationDays * 24 * 60 * 60 * 1000
  );
  return this.save();
};
propertySchema.statics.getFeaturedProperties = function () {
  return this.find({
    isFeatured: true,
    featuredExpiry: { $gt: new Date() },
  }).populate("agent", "name email phone");
};

// Index for better query performance
propertySchema.index({ agent: 1, createdAt: -1 });
propertySchema.index({ isFeatured: 1, featuredExpiry: 1 });
propertySchema.index({ subscriptionUsed: 1 });

module.exports = mongoose.model("Property", propertySchema);
