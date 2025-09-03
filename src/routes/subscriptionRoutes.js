const express = require("express");
const {
  getSubscriptionPlans,
  getMySubscription,
  subscribeToPlan,
  verifySubscriptionPayment,
  cancelSubscription,
  getSubscriptionUsage,
  renewSubscription,
  getAllSubscriptions,
} = require("../controllers/subscriptionController");

const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.get("/plans", getSubscriptionPlans);

// Protected routes (require authentication)
router.use(protect);

// Agent-only routes
router.get("/my-subscription", authorize("agent"), getMySubscription);
router.post("/subscribe", authorize("agent"), subscribeToPlan);
router.post("/verify-payment", authorize("agent"), verifySubscriptionPayment);
router.put("/cancel", authorize("agent"), cancelSubscription);
router.get("/usage", authorize("agent"), getSubscriptionUsage);
router.post("/renew", authorize("agent"), renewSubscription);

// Admin-only routes
router.get("/all", authorize("admin"), getAllSubscriptions);

module.exports = router;
