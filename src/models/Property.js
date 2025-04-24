const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
  },
  address: {
    type: String,
    required: [true, 'Please add an address'],
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
      index: '2dsphere',
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
    enum: ['apartment', 'house', 'condo', 'land'],
    required: true,
  },
  status: {
    type: String,
    enum: ['rent', 'sale', 'sold', 'rented'],
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
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Geocode & create location field
propertySchema.pre('save', async function (next) {
  // You would typically use a geocoding service here
  // For simplicity, we'll just set some basic fields
  this.location = {
    type: 'Point',
    coordinates: [0, 0], // Replace with actual coordinates
    formattedAddress: this.address,
    street: this.address.split(',')[0],
    city: this.address.split(',')[1],
    state: this.address.split(',')[2],
    zipcode: this.address.split(',')[3],
    country: this.address.split(',')[4] || 'USA',
  };
  
  // Do not save address in DB
  this.address = undefined;
  next();
});

module.exports = mongoose.model('Property', propertySchema);