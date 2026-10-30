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
 * Normalizes multipart fields after Multer has parsed the request.
 */
const normalizeMultipartFields = (req, res, next) => {
  const merged = Object.assign({}, req.body || {});

  if (merged.title !== undefined) merged.title = String(merged.title).trim();

  req.body = merged;
  next();
};

const logEditorialMultipart = (req, res, next) => {
  console.log("CONTENT TYPE:", req.headers["content-type"]);
  console.log("EDITORIAL BODY:", req.body);
  console.log("EDITORIAL FILE:", req.file);
  next();
};

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authMiddleware, adminMiddleware, uploadLimiter, setEditorialUploadType, uploadMiddleware.editorialSingle("image"), normalizeMultipartFields, logEditorialMultipart, validate(editorialSchema), controller.create);
router.put("/:id", authMiddleware, adminMiddleware, uploadLimiter, setEditorialUploadType, uploadMiddleware.editorialSingle("image"), normalizeMultipartFields, logEditorialMultipart, validate(editorialUpdateSchema), controller.update);
router.patch("/:id", authMiddleware, adminMiddleware, validate(editorialUpdateSchema), controller.patchStatus);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
