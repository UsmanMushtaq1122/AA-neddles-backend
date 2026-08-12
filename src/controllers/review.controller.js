const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const logger = require("../config/logger");

exports.getAllReviews = async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      include: { product: true, customer: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

exports.getReviewsByProduct = async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

exports.createReview = async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError("Product not found", 404);

    const existingReview = await prisma.review.findFirst({
      where: { productId, customerId: req.user.customerId },
    });
    if (existingReview) {
      throw new AppError("You have already reviewed this product", 409);
    }

    const review = await prisma.review.create({
      data: {
        productId,
        customerId: req.user.customerId,
        rating: parseInt(rating),
        comment,
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

exports.updateReview = async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) throw new AppError("Review not found", 404);

    if (review.customerId !== req.user.customerId && req.user.role !== "ADMIN") {
      throw new AppError("You can only update your own reviews", 403);
    }

    const { rating, comment, isApproved } = req.body;
    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        ...(rating !== undefined && { rating: parseInt(rating) }),
        ...(comment !== undefined && { comment }),
        ...(isApproved !== undefined && { isApproved: Boolean(isApproved) }),
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) throw new AppError("Review not found", 404);

    logger.warn(`Admin delete: review ${req.params.id} deleted by user ${req.user.id}`, {
      action: "DELETE_REVIEW",
      reviewId: req.params.id,
      userId: req.user.id,
    });

    await prisma.review.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    next(error);
  }
};
