const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");
const validate = require("../middlewares/validation.middleware");
const { uploadLimiter } = require("../middlewares/rateLimit.middleware");
const { createCategorySchema, updateCategorySchema } = require("../validations/category.validation");

const handleUpload = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return uploadMiddleware.single("image")(req, res, next);
  }
  next();
};

router.get("/", categoryController.getAllCategories);
router.get("/slug/:slug", categoryController.getCategoryBySlug);
router.get("/:id", categoryController.getCategoryById);
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  uploadLimiter,
  (req, res, next) => { req.uploadType = "categories"; next(); },
  handleUpload,
  validate(createCategorySchema),
  categoryController.createCategory
);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  uploadLimiter,
  (req, res, next) => { req.uploadType = "categories"; next(); },
  handleUpload,
  validate(updateCategorySchema),
  categoryController.updateCategory
);
router.delete("/:id", authMiddleware, adminMiddleware, categoryController.deleteCategory);

module.exports = router;
