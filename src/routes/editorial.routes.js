const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");
const controller = require("../controllers/editorial.controller");
const validate = require("../middlewares/validation.middleware");
const { uploadLimiter } = require("../middlewares/rateLimit.middleware");
const { editorialSchema, editorialUpdateSchema } = require("../validations/common.validation");

const setUploadType = (req, res, next) => {
  req.uploadType = "products";
  next();
};

const handleUpload = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return uploadMiddleware.single("image")(req, res, next);
  }
  next();
};

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  uploadLimiter,
  setUploadType,
  handleUpload,
  validate(editorialSchema),
  controller.create
);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  uploadLimiter,
  setUploadType,
  handleUpload,
  validate(editorialUpdateSchema),
  controller.update
);
router.patch(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validate(editorialUpdateSchema),
  controller.patchStatus
);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
