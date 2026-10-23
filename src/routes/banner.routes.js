const express = require("express");
const router = express.Router();
const bannerController = require("../controllers/banner.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");
const validate = require("../middlewares/validation.middleware");
const { uploadLimiter } = require("../middlewares/rateLimit.middleware");
const { bannerSchema, bannerUpdateSchema } = require("../validations/common.validation");

router.get("/", bannerController.getAllBanners);
const setBannerUploadType = (req, res, next) => {
  req.uploadType = "banners";
  next();
};

router.post("/", authMiddleware, adminMiddleware, uploadLimiter, setBannerUploadType, uploadMiddleware.bannerImages, validate(bannerSchema), bannerController.createBanner);
router.put("/:id", authMiddleware, adminMiddleware, uploadLimiter, setBannerUploadType, uploadMiddleware.bannerImages, validate(bannerUpdateSchema), bannerController.updateBanner);
router.delete("/:id", authMiddleware, adminMiddleware, bannerController.deleteBanner);

module.exports = router;
