const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const validate = require("../middlewares/validation.middleware");
const { createReviewSchema, updateReviewSchema } = require("../validations/review.validation");

router.get("/", authMiddleware, adminMiddleware, reviewController.getAllReviews);
router.get("/product/:productId", reviewController.getReviewsByProduct);
router.post("/", authMiddleware, validate(createReviewSchema), reviewController.createReview);
router.put("/:id", authMiddleware, validate(updateReviewSchema), reviewController.updateReview);
router.delete("/:id", authMiddleware, adminMiddleware, reviewController.deleteReview);

module.exports = router;
