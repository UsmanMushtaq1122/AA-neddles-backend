const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");

router.get("/stats", authMiddleware, adminMiddleware, dashboardController.getStats);
router.get("/sales", authMiddleware, adminMiddleware, dashboardController.getSalesData);
router.get("/recent-orders", authMiddleware, adminMiddleware, dashboardController.getRecentOrders);

module.exports = router;
