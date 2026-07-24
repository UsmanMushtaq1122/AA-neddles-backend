const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");

router.post("/", authMiddleware, paymentController.createPayment);
router.post("/verify/:id", authMiddleware, paymentController.verifyPayment);
router.get("/order/:orderId", authMiddleware, paymentController.getPaymentByOrder);
router.get("/", authMiddleware, adminMiddleware, paymentController.getAllPayments);

module.exports = router;
