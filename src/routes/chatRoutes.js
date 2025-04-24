const express = require('express');
const {
  getOrCreateChat,
  getUserChats,
  getChatMessages,
  sendMessage,
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/').post(protect, getOrCreateChat).get(protect, getUserChats);

router
  .route('/:chatId/messages')
  .get(protect, getChatMessages)
  .post(protect, sendMessage);

module.exports = router;