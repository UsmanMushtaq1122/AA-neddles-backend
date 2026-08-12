const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");
const validate = require("../middlewares/validation.middleware");
const { uploadLimiter } = require("../middlewares/rateLimit.middleware");
const { createProductSchema, updateProductSchema, checkDuplicatesSchema } = require("../validations/product.validation");

router.get("/", productController.getAllProducts);
router.get("/facets", productController.getProductFacets);
router.get("/slug/:slug", productController.getProductBySlug);
router.get("/:id", productController.getProductById);
router.post(
  "/check-duplicates",
  authMiddleware,
  adminMiddleware,
  validate(checkDuplicatesSchema),
  productController.checkProductDuplicates
);
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  uploadLimiter,
  (req, res, next) => {
    req.uploadType = "products";
    next();
  },
  uploadMiddleware.single("image"),
  validate(createProductSchema),
  productController.createProduct
);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  uploadLimiter,
  (req, res, next) => {
    req.uploadType = "products";
    next();
  },
  uploadMiddleware.single("image"),
  validate(updateProductSchema),
  productController.updateProduct
);
router.post(
  "/bulk-upload",
  authMiddleware,
  adminMiddleware,
  uploadLimiter,
  (req, res, next) => {
    req.uploadType = "products";
    next();
  },
  uploadMiddleware.array("images", 5),
  productController.bulkUploadImages
);
router.delete("/:id", authMiddleware, adminMiddleware, productController.deleteProduct);

module.exports = router;
