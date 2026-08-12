const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const validate = require("../middlewares/validation.middleware");
const { customerUpdateSchema } = require("../validations/common.validation");

router.get("/profile", authMiddleware, customerController.getMyProfile);
router.get("/", authMiddleware, adminMiddleware, customerController.getAllCustomers);
router.get("/:id", authMiddleware, adminMiddleware, customerController.getCustomerById);
router.put("/:id", authMiddleware, validate(customerUpdateSchema), customerController.updateCustomer);
router.delete("/:id", authMiddleware, adminMiddleware, customerController.deleteCustomer);
router.post("/:id/verify-email", authMiddleware, adminMiddleware, customerController.manuallyVerifyEmail);

module.exports = router;

