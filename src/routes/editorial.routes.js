const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/editorial.controller");
const validate = require("../middlewares/validation.middleware");
const { editorialSchema, editorialUpdateSchema } = require("../validations/common.validation");
const uploadMiddleware = require("../middlewares/upload.middleware");
const { uploadLimiter } = require("../middlewares/rateLimit.middleware");

const setEditorialUploadType = (req, res, next) => {
  req.uploadType = "editorial";
  next();
};

/**
 * Normalizes multipart form fields after Multer runs.
 *
 * multer-storage-cloudinary@4 streams files directly to Cloudinary and can
 * leave req.body empty or incomplete when the upload finishes. To work around
 * this, the frontend also sends critical fields (e.g. title) as query-string
 * parameters. This middleware merges query params into req.body as a fallback
 * so that validation always sees the correct values.
 */
const normalizeMultipartFields = (req, res, next) => {
  const merged = Object.assign({}, req.body || {});

  // Promote query-string fields that are missing or empty in the body
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (merged[key] === undefined || merged[key] === "") {
        merged[key] = req.query[key];
      }
    });
  }

  // Header fallback specifically for title
  const headerTitle = req.get("X-Editorial-Title");
  if ((!merged.title || merged.title === "") && headerTitle) {
    merged.title = headerTitle;
  }

  // Trim the title if present
  if (merged.title) merged.title = String(merged.title).trim();

  req.body = merged;
  next();
};

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authMiddleware, adminMiddleware, uploadLimiter, setEditorialUploadType, uploadMiddleware.single("image"), normalizeMultipartFields, validate(editorialSchema), controller.create);
router.put("/:id", authMiddleware, adminMiddleware, uploadLimiter, setEditorialUploadType, uploadMiddleware.single("image"), normalizeMultipartFields, validate(editorialUpdateSchema), controller.update);
router.patch("/:id", authMiddleware, adminMiddleware, validate(editorialUpdateSchema), controller.patchStatus);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
