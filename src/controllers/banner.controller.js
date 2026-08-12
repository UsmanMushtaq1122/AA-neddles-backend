const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const { extractPublicIdFromUrl, deleteFromCloudinary, enrichArrayWithOptimizedUrls, enrichWithOptimizedUrls } = require("../utils/cloudinary");

exports.getAllBanners = async (req, res, next) => {
  try {
    const where = req.query.all === "true" ? {} : { isActive: true };
    const banners = await prisma.banner.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    res.status(200).json({ success: true, data: enrichArrayWithOptimizedUrls(banners) });
  } catch (error) {
    next(error);
  }
};

exports.createBanner = async (req, res, next) => {
  try {
    const { title, subtitle, link, buttonText, type, sortOrder, isActive, bgColor, textColor, imageUrl } = req.body;
    const image = req.file ? req.file.path : (req.body.image || imageUrl);
    const imagePublicId = req.file ? req.file.filename : null;

    if ((type === "hero" || type === "editorial" || !type) && !image) {
      throw new AppError("Banner image is required", 400);
    }

    const banner = await prisma.banner.create({
      data: {
        title: title || req.body.text || "",
        subtitle: subtitle || null,
        image: image || null,
        imagePublicId: imagePublicId || null,
        link: link || null,
        buttonText: buttonText || null,
        type: type || "hero",
        sortOrder: sortOrder ? parseInt(sortOrder) : 0,
        isActive: isActive === "true" || isActive === true,
        bgColor: bgColor || null,
        textColor: textColor || null,
      },
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

    const { title, subtitle, link, buttonText, type, sortOrder, isActive, bgColor, textColor, imageUrl } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    else if (req.body.text !== undefined) data.title = req.body.text; // map text to title
    if (subtitle !== undefined) data.subtitle = subtitle;
    if (link !== undefined) data.link = link;
    if (buttonText !== undefined) data.buttonText = buttonText;
    if (type !== undefined) data.type = type;
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);
    if (isActive !== undefined) data.isActive = isActive === "true" || isActive === true;
    if (bgColor !== undefined) data.bgColor = bgColor;
    if (textColor !== undefined) data.textColor = textColor;

    let oldPublicId = null;
    if (req.file) {
      data.image = req.file.path;
      data.imagePublicId = req.file.filename;
      oldPublicId = banner.imagePublicId || extractPublicIdFromUrl(banner.image);
    } else if (req.body.image !== undefined || imageUrl !== undefined) {
      data.image = req.body.image || imageUrl;
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
