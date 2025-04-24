const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
  ],
  property: {
    type: mongoose.Schema.ObjectId,
    ref: 'Property',
  },
  lastMessage: {
    type: mongoose.Schema.ObjectId,
    ref: 'Message',
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

module.exports = mongoose.model('Chat', chatSchema);