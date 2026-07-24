const express = require("express");
const router = express.Router();
const bannerController = require("../controllers/banner.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");
const { uploadLimiter } = require("../middlewares/rateLimit.middleware");

router.get("/", bannerController.getAllBanners);
router.post("/", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "banners"; next(); }, uploadMiddleware.single("image"), bannerController.createBanner);
router.put("/:id", authMiddleware, adminMiddleware, uploadLimiter, (req, res, next) => { req.uploadType = "banners"; next(); }, uploadMiddleware.single("image"), bannerController.updateBanner);
router.delete("/:id", authMiddleware, adminMiddleware, bannerController.deleteBanner);

module.exports = router;
