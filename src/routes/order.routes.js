const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const validate = require("../middlewares/validation.middleware");
const { createOrderSchema } = require("../validations/order.validation");
const { orderStatusSchema, orderNotesSchema, orderTrackingSchema } = require("../validations/common.validation");

router.get("/", authMiddleware, adminMiddleware, orderController.getAllOrders);
router.get("/track/:orderNumber", orderController.trackOrder);
router.get("/my-orders", authMiddleware, orderController.getMyOrders);
router.get("/:id", authMiddleware, orderController.getOrderById);
router.post("/", authMiddleware, validate(createOrderSchema), orderController.createOrder);
router.put("/:id/status", authMiddleware, adminMiddleware, validate(orderStatusSchema), orderController.updateOrderStatus);
router.put("/:id/notes", authMiddleware, adminMiddleware, validate(orderNotesSchema), orderController.updateOrderNotes);
router.put("/:id/tracking", authMiddleware, adminMiddleware, validate(orderTrackingSchema), orderController.updateOrderTracking);
router.delete("/:id", authMiddleware, adminMiddleware, orderController.deleteOrder);

module.exports = router;
