const express = require("express");
const router = express.Router();
const testimonialController = require("../controllers/testimonial.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");
const { uploadLimiter } = require("../middlewares/rateLimit.middleware");

router.get("/", testimonialController.getAllTestimonials);
router.post("/", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "testimonials"; next(); }, uploadMiddleware.single("image"), testimonialController.createTestimonial);
router.put("/:id", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "testimonials"; next(); }, uploadMiddleware.single("image"), testimonialController.updateTestimonial);
router.delete("/:id", authMiddleware, adminMiddleware, testimonialController.deleteTestimonial);

module.exports = router;
