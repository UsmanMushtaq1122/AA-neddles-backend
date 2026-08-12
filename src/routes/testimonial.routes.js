const express = require("express");
const router = express.Router();
const testimonialController = require("../controllers/testimonial.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");
const validate = require("../middlewares/validation.middleware");
const { uploadLimiter } = require("../middlewares/rateLimit.middleware");
const { testimonialSchema, testimonialUpdateSchema } = require("../validations/common.validation");

router.get("/", testimonialController.getAllTestimonials);
router.post("/", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "testimonials"; next(); }, uploadMiddleware.single("image"), validate(testimonialSchema), testimonialController.createTestimonial);
router.put("/:id", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "testimonials"; next(); }, uploadMiddleware.single("image"), validate(testimonialUpdateSchema), testimonialController.updateTestimonial);
router.delete("/:id", authMiddleware, adminMiddleware, testimonialController.deleteTestimonial);

module.exports = router;
