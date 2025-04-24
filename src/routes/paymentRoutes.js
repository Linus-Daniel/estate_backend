const express = require('express');
const {
  initializePayment,
  verifyPayment,
  getUserTransactions,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/initialize', protect, initializePayment);
router.get('/verify/:reference', protect, verifyPayment);
router.get('/transactions', protect, getUserTransactions);

module.exports = router;
