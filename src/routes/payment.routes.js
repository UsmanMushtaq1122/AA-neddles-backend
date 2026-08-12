const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const validate = require("../middlewares/validation.middleware");
const { createPaymentSchema, refundPaymentSchema } = require("../validations/payment.validation");

router.post("/", authMiddleware, validate(createPaymentSchema), paymentController.createPayment);
router.post("/verify/:id", authMiddleware, adminMiddleware, paymentController.verifyPayment);
router.get("/order/:orderId", authMiddleware, paymentController.getPaymentByOrder);
router.get("/", authMiddleware, adminMiddleware, paymentController.getAllPayments);
router.post("/:id/refund", authMiddleware, adminMiddleware, validate(refundPaymentSchema), paymentController.refundPayment);

module.exports = router;
