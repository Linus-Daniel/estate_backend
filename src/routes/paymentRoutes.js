const express = require('express');
const {
  initializePayment,
  verifyPayment,
  getUserTransactions,
  getTransactionById,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/initialize', protect, initializePayment);
router.get('/verify/:reference', protect, verifyPayment);
router.get('/transactions/:userId', protect, getUserTransactions);
router.get('/transaction/:id', protect, getTransactionById);


module.exports = router;
