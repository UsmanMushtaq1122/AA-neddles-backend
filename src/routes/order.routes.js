const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const validate = require("../middlewares/validation.middleware");
const { createOrderSchema } = require("../validations/order.validation");

router.get("/", authMiddleware, adminMiddleware, orderController.getAllOrders);
router.get("/my-orders", authMiddleware, orderController.getMyOrders);
router.get("/:id", authMiddleware, orderController.getOrderById);
router.post("/", authMiddleware, validate(createOrderSchema), orderController.createOrder);
router.put("/:id/status", authMiddleware, adminMiddleware, orderController.updateOrderStatus);
router.delete("/:id", authMiddleware, adminMiddleware, orderController.deleteOrder);

module.exports = router;
