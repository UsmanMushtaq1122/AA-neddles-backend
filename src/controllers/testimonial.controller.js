const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const { extractPublicIdFromUrl, deleteFromCloudinary, enrichArrayWithOptimizedUrls, enrichWithOptimizedUrls } = require("../utils/cloudinary");

exports.getAllTestimonials = async (req, res, next) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: enrichArrayWithOptimizedUrls(testimonials) });
  } catch (error) {
    next(error);
  }
};

exports.createTestimonial = async (req, res, next) => {
  try {
    const { name, comment, rating, isActive } = req.body;
    const image = req.file ? req.file.path : null;
    const imagePublicId = req.file ? req.file.filename : null;

    const testimonial = await prisma.testimonial.create({
      data: { name, image, imagePublicId, comment, rating: parseInt(rating), isActive: isActive === "true" || isActive === true },
    });
    res.status(201).json({ success: true, data: enrichWithOptimizedUrls(testimonial) });
  } catch (error) {
    if (req.file && req.file.filename) {
      await deleteFromCloudinary(req.file.filename).catch(() => {});
    }
    next(error);
  }
};

exports.updateTestimonial = async (req, res, next) => {
  try {
    const testimonial = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
    if (!testimonial) throw new AppError("Testimonial not found", 404);

    const { name, comment, rating, isActive } = req.body;
    const data = {};
    if (name) data.name = name;
    if (comment) data.comment = comment;
    if (rating) data.rating = parseInt(rating);
    if (isActive !== undefined) data.isActive = isActive === "true" || isActive === true;

    let oldPublicId = null;
    if (req.file) {
      data.image = req.file.path;
      data.imagePublicId = req.file.filename;
      oldPublicId = testimonial.imagePublicId || extractPublicIdFromUrl(testimonial.image);
    }

    const updated = await prisma.testimonial.update({ where: { id: req.params.id }, data });

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

exports.deleteTestimonial = async (req, res, next) => {
  try {
    const testimonial = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
    if (!testimonial) throw new AppError("Testimonial not found", 404);

    const publicId = testimonial.imagePublicId || extractPublicIdFromUrl(testimonial.image);

    await prisma.testimonial.delete({ where: { id: req.params.id } });

    if (publicId) {
      await deleteFromCloudinary(publicId);
    }

    res.status(200).json({ success: true, message: "Testimonial deleted successfully" });
  } catch (error) {
    next(error);
  }
};
