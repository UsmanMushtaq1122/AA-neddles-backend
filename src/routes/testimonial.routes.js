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
router.get("/admin", authMiddleware, adminMiddleware, testimonialController.getAllTestimonialsForAdmin);
router.post("/video", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "testimonials"; next(); }, uploadMiddleware.singleVideo("video"), validate(testimonialSchema), testimonialController.createTestimonial);
router.post("/", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "testimonials"; next(); }, uploadMiddleware.single("image"), validate(testimonialSchema), testimonialController.createTestimonial);
router.put("/:id/video", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "testimonials"; next(); }, uploadMiddleware.singleVideo("video"), validate(testimonialUpdateSchema), testimonialController.updateTestimonial);
router.put("/:id", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "testimonials"; next(); }, uploadMiddleware.single("image"), validate(testimonialUpdateSchema), testimonialController.updateTestimonial);
router.delete("/:id", authMiddleware, adminMiddleware, testimonialController.deleteTestimonial);

module.exports = router;
