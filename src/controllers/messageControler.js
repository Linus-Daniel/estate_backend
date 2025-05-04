const Message = require('../models/Message');
const Chat = require('../models/Chat');
const ErrorResponse = require('../utils/errorResponse');

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
      return next(new ErrorResponse('Not authorized to access this chat', 401));
    }

    const messages = await Message.find({ chat: req.params.chatId })
      .sort('createdAt')
      .populate('sender', 'name email photo role');

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
      return next(new ErrorResponse('Message content is required', 400));
    }

    // Check if user is part of the chat
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: { $in: [req.user.id] },
    });

    if (!chat) {
      return next(new ErrorResponse('Not authorized to send message to this chat', 401));
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
      'name email photo role'
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