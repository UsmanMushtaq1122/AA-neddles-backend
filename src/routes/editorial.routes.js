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

const normalizeMultipartTitle = (req, res, next) => {
  if ((!req.body || !req.body.title) && req.query.title) {
    req.body = req.body || {};
    req.body.title = req.query.title;
  }
  if (req.body?.title) {
    req.body.title = String(req.body.title).trim();
  }
  next();
};

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authMiddleware, adminMiddleware, uploadLimiter, setEditorialUploadType, uploadMiddleware.single("image"), normalizeMultipartTitle, validate(editorialSchema), controller.create);
router.put("/:id", authMiddleware, adminMiddleware, uploadLimiter, setEditorialUploadType, uploadMiddleware.single("image"), normalizeMultipartTitle, validate(editorialUpdateSchema), controller.update);
router.patch("/:id", authMiddleware, adminMiddleware, validate(editorialUpdateSchema), controller.patchStatus);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
