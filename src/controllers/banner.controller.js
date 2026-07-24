const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const { extractPublicIdFromUrl, deleteFromCloudinary, enrichArrayWithOptimizedUrls, enrichWithOptimizedUrls } = require("../utils/cloudinary");

exports.getAllBanners = async (req, res, next) => {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: enrichArrayWithOptimizedUrls(banners) });
  } catch (error) {
    next(error);
  }
};

exports.createBanner = async (req, res, next) => {
  try {
    const { title, link, isActive } = req.body;
    const image = req.file ? req.file.path : null;
    const imagePublicId = req.file ? req.file.filename : null;

    if (!image) throw new AppError("Banner image is required", 400);

    const banner = await prisma.banner.create({
      data: { title, image, imagePublicId, link, isActive: isActive === "true" || isActive === true },
    });
    res.status(201).json({ success: true, data: enrichWithOptimizedUrls(banner) });
  } catch (error) {
    if (req.file && req.file.filename) {
      await deleteFromCloudinary(req.file.filename).catch(() => {});
    }
    next(error);
  }
};

exports.updateBanner = async (req, res, next) => {
  try {
    const banner = await prisma.banner.findUnique({ where: { id: req.params.id } });
    if (!banner) throw new AppError("Banner not found", 404);

    const { title, link, isActive } = req.body;
    const data = {};
    if (title) data.title = title;
    if (link !== undefined) data.link = link;
    if (isActive !== undefined) data.isActive = isActive === "true" || isActive === true;

    let oldPublicId = null;
    if (req.file) {
      data.image = req.file.path;
      data.imagePublicId = req.file.filename;
      oldPublicId = banner.imagePublicId || extractPublicIdFromUrl(banner.image);
    }

    const updated = await prisma.banner.update({ where: { id: req.params.id }, data });

    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

    res.status(200).json({ success: true, data: enrichWithOptimizedUrls(updated) });
  } catch (error) {
    if (req.file && req.file.filename) {
      await deleteFromCloudinary(req.file.filename).catch(() => {});
    }
    next(error);
  }
};

exports.deleteBanner = async (req, res, next) => {
  try {
    const banner = await prisma.banner.findUnique({ where: { id: req.params.id } });
    if (!banner) throw new AppError("Banner not found", 404);

    const publicId = banner.imagePublicId || extractPublicIdFromUrl(banner.image);

    await prisma.banner.delete({ where: { id: req.params.id } });

    if (publicId) {
      await deleteFromCloudinary(publicId);
    }

    res.status(200).json({ success: true, message: "Banner deleted successfully" });
  } catch (error) {
    next(error);
  }
};
