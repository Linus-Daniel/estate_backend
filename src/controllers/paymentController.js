const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const ErrorResponse = require('../utils/errorResponse');


console.log(paystack)

// @desc    Initialize Paystack payment
// @route   POST /api/v1/payments/initialize
// @access  Private
exports.initializePayment = async (req, res, next) => {
  try {
    const { propertyId, email,callback_url } = req.body;

    // Validate required fields
    if (!propertyId || !email) {
      return next(new ErrorResponse('Property ID and email are required', 400));
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return next(new ErrorResponse(`Property not found with ID ${propertyId}`, 404));
    }

    // Use property price to prevent tampering from client
    const amount = property.price;
    const amountInKobo = amount * 100;

    // Validate amount
    if (amount <= 0) {
      return next(new ErrorResponse('Invalid payment amount', 400));
    }

    const paymentPayload = {
      email,
      amount: amountInKobo,
      currency: 'NGN',
      metadata: {
        propertyId,
        userId: req.user.id,
        propertyTitle: property.title // Add more context
      },
      callback_url: process.env.PAYSTACK_CALLBACK_URL // Add callback URL if needed
    };

    const payment = await paystack.transaction.initialize(paymentPayload);

    // Check if payment initialization was successful
    if (!payment || !payment.data || !payment.data.reference) {
      console.error('Invalid Paystack response:', payment);
      return next(new ErrorResponse('Failed to initialize payment', 500));
    }

    // Create transaction record
    const transaction = await Transaction.create({
      user: req.user.id,
      property: propertyId,
      amount,
      status: 'pending',
      transactionId: payment.data.reference,
      paymentMethod: 'paystack',
      authorizationUrl: payment.data.authorization_url
    });

    res.status(200).json({
      success: true,
      authorizationUrl: payment.data.authorization_url,
      reference: payment.data.reference,
      transactionId: transaction._id
    });

  } catch (err) {
    console.error('Payment initialization error:', err);
    next(err);
  }
};

// @desc    Verify Paystack payment
// @route   GET /api/v1/payments/verify/:reference
// @access  Private
exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return next(new ErrorResponse('Reference is required', 400));
    }

    const response = await paystack.transaction.verify(reference);

    // Check if verification was successful
    if (!response || !response.data) {
      console.error('Invalid Paystack verification response:', response);
      return next(new ErrorResponse('Payment verification failed', 400));
    }

    const transaction = await Transaction.findOne({ transactionId: reference });
    if (!transaction) {
      return next(new ErrorResponse('Transaction not found', 404));
    }

    // Avoid updating an already completed transaction
    if (transaction.status === 'completed') {
      return res.status(200).json({ 
        success: true, 
        message: 'Transaction already completed',
        data: transaction 
      });
    }

    // Update transaction based on Paystack response
    if (response.data.status === 'success') {
      transaction.status = 'completed';
      transaction.paidAt = response.data.paid_at || new Date();
      transaction.channel = response.data.channel;
      transaction.currency = response.data.currency;
      transaction.customer = response.data.customer?.email || transaction.customer;
      transaction.gatewayResponse = response.data.gateway_response;
      await transaction.save();

      // Update property status if needed
      if (transaction.amount >= 1000) {
        await Property.findByIdAndUpdate(
          transaction.property, 
          { status: 'sold' },
          { new: true }
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: transaction
      });
    }

    // Handle other statuses (failed, abandoned, etc.)
    transaction.status = response.data.status || 'failed';
    await transaction.save();

    return res.status(400).json({
      success: false,
      message: `Payment ${response.data.status || 'not completed'}`,
      data: transaction
    });

  } catch (err) {
    console.error('Paystack verification error:', err);
    next(new ErrorResponse('Payment verification failed', 500));
  }
};

// @desc    Get user transactions
// @route   GET /api/v1/payments/transactions
// @access  Private
exports.getUserTransactions = async (req, res, next) => {
  const {userId} = req.params
  try {
    const transactions = await Transaction.find({ user:userId })
      .populate('property', 'title price location images')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (err) {
    console.error('Get transactions error:', err);
    next(new ErrorResponse('Failed to retrieve transactions', 500));
  }
};

// controllers/transactionController.js

exports.getTransactionById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('property', 'title price location images type amenities bedrooms bathrooms');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }
    console.log("Transacton found")

    res.status(200).json({
      success: true,
      data: transaction,
      message:`Transaction  of Id ${id} found`
    });

  } catch (err) {
    console.error('Get transaction by ID error:', err);
    next(new Error('Failed to retrieve transaction'));
  }
};
