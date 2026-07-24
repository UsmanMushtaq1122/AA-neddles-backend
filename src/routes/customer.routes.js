const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");

router.get("/profile", authMiddleware, customerController.getMyProfile);
router.get("/", authMiddleware, adminMiddleware, customerController.getAllCustomers);
router.get("/:id", authMiddleware, adminMiddleware, customerController.getCustomerById);
router.put("/:id", authMiddleware, customerController.updateCustomer);
router.delete("/:id", authMiddleware, adminMiddleware, customerController.deleteCustomer);

module.exports = router;
