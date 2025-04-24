const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Initialize Paystack payment
// @route   POST /api/v1/payments/initialize
// @access  Private
exports.initializePayment = async (req, res, next) => {
  try {
    const { propertyId, amount, email } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return next(new ErrorResponse(`Property not found with id ${propertyId}`, 404));
    }

    // Convert amount to kobo (Paystack uses kobo for NGN)
    const amountInKobo = amount * 100;

    // Initialize Paystack payment
    const payment = await paystack.transaction.initialize({
      email,
      amount: amountInKobo,
      currency: 'NGN', // or 'USD' if your Paystack account supports it
      metadata: {
        propertyId,
        userId: req.user.id
      }
    });

    // Create transaction record
    const transaction = await Transaction.create({
      user: req.user.id,
      property: propertyId,
      amount,
      status: 'pending',
      transactionId: payment.data.reference,
      paymentMethod: 'paystack',
    });

    res.status(200).json({
      success: true,
      authorizationUrl: payment.data.authorization_url,
      reference: payment.data.reference,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify Paystack payment
// @route   GET /api/v1/payments/verify/:reference
// @access  Private
exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    // Verify transaction with Paystack
    const response = await paystack.transaction.verify(reference);

    if (!response.data.status === 'success') {
      return next(new ErrorResponse('Payment verification failed', 400));
    }

    // Update transaction status
    const transaction = await Transaction.findOneAndUpdate(
      { transactionId: reference },
      { status: 'completed' },
      { new: true }
    );

    if (!transaction) {
      return next(new ErrorResponse('Transaction not found', 404));
    }

    // Update property status if it's a purchase
    if (transaction.amount >= 1000) {
      await Property.findByIdAndUpdate(transaction.property, {
        status: 'sold',
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user transactions (same as before)
// @route   GET /api/v1/payments/transactions
// @access  Private
exports.getUserTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id })
      .populate('property', 'title price')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
};