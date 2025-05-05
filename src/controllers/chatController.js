const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Property = require('../models/Property');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get or create chat
// @route   POST /api/v1/chats
// @access  Private
exports.getOrCreateChat = async (req, res, next) => {
  try {
    const { participantId, propertyId } = req.body;

    // Check if participants are valid
    const participant = await User.findById(participantId);
    if (!participant) {
      return next(new ErrorResponse(`Participant not found`, 404));
    }

    // Users can't chat with themselves
    if (participantId === req.user.id) {
      return next(new ErrorResponse(`You cannot chat with yourself`, 400));
    }

    // Check if property exists if provided
    if (propertyId) {
      const property = await Property.findById(propertyId);
      if (!property) {
        return next(new ErrorResponse(`Property not found`, 404));
      }
    }

    // Check if chat already exists between these users for this property
    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, participantId] },
      property: propertyId || { $exists: false },
    })
      .populate('participants', 'name email photo')
      .populate('property', 'title price images');

    if (!chat) {
      // Create new chat
      chat = await Chat.create({
        participants: [req.user.id, participantId],
        property: propertyId || null,
      });

      // Populate the new chat
      chat = await Chat.findById(chat._id)
        .populate('participants', 'name email photo')
        .populate('property', 'title price images');
    }

    res.status(200).json({
      success: true,
      data: chat,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user chats
// @route   GET /api/v1/chats
// @access  Private
exports.getUserChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({
      participants: { $in: [req.user.id] },
    })
      .populate({
        path: 'participants',
        select: 'name email photo',
        match: { _id: { $ne: req.user.id } }, // Exclude current user
      })
      .populate('property', 'title price images')
      .populate('lastMessage')
      .sort('-updatedAt');

    // Filter out any chats where participants array is empty (shouldn't happen)
    const filteredChats = chats.filter(chat => chat.participants.length > 0);

    res.status(200).json({
      success: true,
      count: filteredChats.length,
      data: filteredChats,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get chat messages
// @route   GET /api/v1/chats/:chatId/messages
// @access  Private
exports.getChatMessages = async (req, res, next) => {
  try {
    // Check if user is part of the chat
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: { $in: [req.user.id] },
    });

    if (!chat) {
      return next(new ErrorResponse(`Not authorized to access this chat`, 401));
    }

    const messages = await Message.find({ chat: req.params.chatId })
      .sort('createdAt')
      .populate('sender', 'name email photo');

    // Mark messages as read if they're sent to the current user
    await Message.updateMany(
      {
        chat: req.params.chatId,
        sender: { $ne: req.user.id },
        read: false,
      },
      { $set: { read: true } }
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Send message
// @route   POST /api/v1/chats/:chatId/messages
// @access  Private
exports.sendMessage = async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content) {
      return next(new ErrorResponse(`Message content is required`, 400));
    }

    // Check if user is part of the chat
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: { $in: [req.user.id] },
    });

    if (!chat) {
      return next(new ErrorResponse(`Not authorized to send message to this chat`, 401));
    }

    // Create message
    const message = await Message.create({
      chat: req.params.chatId,
      sender: req.user.id,
      content,
    });

    // Populate sender info
    const populatedMessage = await Message.findById(message._id).populate(
      'sender',
      'name email photo'
    );

    // Update chat's last message and timestamp
    await Chat.findByIdAndUpdate(req.params.chatId, {
      lastMessage: message._id,
      updatedAt: Date.now(),
    });

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').to(req.params.chatId).emit('receive message', populatedMessage);
    }

    res.status(201).json({
      success: true,
      data: populatedMessage,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete message
// @route   DELETE /api/v1/chats/:chatId/messages/:messageId
// @access  Private
exports.deleteMessage = async (req, res, next) => {
  try {
    // Check if user is part of the chat
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: { $in: [req.user.id] },
    });

    if (!chat) {
      return next(new ErrorResponse(`Not authorized to access this chat`, 401));
    }

    // Find the message
    const message = await Message.findOne({
      _id: req.params.messageId,
      chat: req.params.chatId,
    });

    if (!message) {
      return next(new ErrorResponse(`Message not found`, 404));
    }

    // Check if user is the sender or admin
    if (
      message.sender.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(
        new ErrorResponse(`Not authorized to delete this message`, 401)
      );
    }

    await message.remove();

    // Update last message if this was the last message
    if (chat.lastMessage.toString() === req.params.messageId) {
      const newLastMessage = await Message.findOne({ chat: req.params.chatId })
        .sort('-createdAt')
        .select('_id');

      await Chat.findByIdAndUpdate(req.params.chatId, {
        lastMessage: newLastMessage ? newLastMessage._id : null,
      });
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Initiate chat with property agent
// @route   POST /api/v1/properties/:propertyId/chat
// @access  Private
exports.initiatePropertyChat = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    // Get property and verify it exists
    const property = await Property.findById(propertyId).populate('agent', 'id');
    if (!property) {
      return next(new ErrorResponse('Property not found', 404));
    }

    // Check if chat already exists between user and agent for this property
    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, property.agent._id] },
      property: propertyId,
    })
      .populate('participants', 'name email photo')
      .populate('property', 'title price images');

    if (!chat) {
      // Create new chat
      chat = await Chat.create({
        participants: [req.user.id, property.agent._id],
        property: propertyId,
      });

      // Populate the new chat
      chat = await Chat.findById(chat._id)
        .populate('participants', 'name email photo')
        .populate('property', 'title price images');
    }

    res.status(200).json({
      success: true,
      data: chat,
    });
  } catch (err) {
    next(err);
  }
};