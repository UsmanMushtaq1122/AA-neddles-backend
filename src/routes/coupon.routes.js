const express = require("express");
const router = express.Router();
const couponController = require("../controllers/coupon.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const validate = require("../middlewares/validation.middleware");
const { createCouponSchema, updateCouponSchema } = require("../validations/coupon.validation");

router.get("/", authMiddleware, adminMiddleware, couponController.getAllCoupons);
router.post("/", authMiddleware, adminMiddleware, validate(createCouponSchema), couponController.createCoupon);
router.put("/:id", authMiddleware, adminMiddleware, validate(updateCouponSchema), couponController.updateCoupon);
router.delete("/:id", authMiddleware, adminMiddleware, couponController.deleteCoupon);

module.exports = router;
