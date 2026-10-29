const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const { extractPublicIdFromUrl, deleteFromCloudinary, createVideoUploadSignature, enrichArrayWithOptimizedUrls, enrichWithOptimizedUrls } = require("../utils/cloudinary");

exports.getVideoUploadSignature = (req, res) => {
  res.status(200).json({ success: true, data: createVideoUploadSignature() });
};

exports.getAllTestimonials = async (req, res, next) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    res.status(200).json({ success: true, data: enrichArrayWithOptimizedUrls(testimonials) });
  } catch (error) {
    next(error);
  }
};

exports.getAllTestimonialsForAdmin = async (req, res, next) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    res.status(200).json({ success: true, data: enrichArrayWithOptimizedUrls(testimonials) });
  } catch (error) {
    next(error);
  }
};

exports.createTestimonial = async (req, res, next) => {
  try {
    const { customerName, content, rating, isActive, type, videoUrl, sortOrder, image: imageUrl } = req.body;
    const isVideoUpload = req.file?.fieldname === "video";
    const image = req.file && !isVideoUpload ? req.file.path : imageUrl || null;
    const imagePublicId = req.file && !isVideoUpload ? req.file.filename : null;
    const maxOrder = await prisma.testimonial.aggregate({ _max: { sortOrder: true } });

    const testimonial = await prisma.testimonial.create({
      data: {
        customerName,
        image,
        imagePublicId,
        content,
        rating: parseInt(rating, 10),
        isActive: isActive === "true" || isActive === true,
        type: type || "gallery",
        videoUrl: isVideoUpload ? req.file.path : videoUrl || null,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    res.status(201).json({ success: true, data: enrichWithOptimizedUrls(testimonial) });
  } catch (error) {
    if (req.file && req.file.filename) {
      await deleteFromCloudinary(req.file.filename, req.file.fieldname === "video" ? "video" : "image").catch(() => {});
    }
    next(error);
  }
};

exports.updateTestimonial = async (req, res, next) => {
  let updateSaved = false;
  try {
    const testimonial = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
    if (!testimonial) throw new AppError("Testimonial not found", 404);

    const { customerName, content, rating, isActive, type, videoUrl, sortOrder, image: imageUrl } = req.body;
    const data = {};
    if (customerName !== undefined) data.customerName = customerName;
    if (content !== undefined) data.content = content;
    if (rating !== undefined) data.rating = parseInt(rating, 10);
    if (isActive !== undefined) data.isActive = isActive === "true" || isActive === true;
    if (type !== undefined) data.type = type;
    if (videoUrl !== undefined) data.videoUrl = videoUrl || null;
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder, 10);

    const assetsToDelete = [];
    if (req.file) {
      if (req.file.fieldname === "video") {
        data.videoUrl = req.file.path;
        const oldVideoId = testimonial.type === "video" ? extractPublicIdFromUrl(testimonial.videoUrl) : null;
        if (oldVideoId) assetsToDelete.push({ publicId: oldVideoId, resourceType: "video" });
      } else {
        data.image = req.file.path;
        data.imagePublicId = req.file.filename;
        const oldImageId = testimonial.imagePublicId || extractPublicIdFromUrl(testimonial.image);
        if (oldImageId) assetsToDelete.push({ publicId: oldImageId, resourceType: "image" });
      }
    } else if (imageUrl !== undefined && imageUrl !== testimonial.image) {
      data.image = imageUrl || null;
      data.imagePublicId = null;
      const oldImageId = testimonial.imagePublicId || extractPublicIdFromUrl(testimonial.image);
      if (oldImageId) assetsToDelete.push({ publicId: oldImageId, resourceType: "image" });
    }

    if (type !== undefined && type !== "video" && testimonial.type === "video") {
      data.videoUrl = null;
      const oldVideoId = extractPublicIdFromUrl(testimonial.videoUrl);
      if (oldVideoId) assetsToDelete.push({ publicId: oldVideoId, resourceType: "video" });
    } else if (videoUrl !== undefined && videoUrl !== testimonial.videoUrl && testimonial.type === "video" && !req.file) {
      const oldVideoId = extractPublicIdFromUrl(testimonial.videoUrl);
      if (oldVideoId) assetsToDelete.push({ publicId: oldVideoId, resourceType: "video" });
    }

    const updated = await prisma.testimonial.update({ where: { id: req.params.id }, data });
    updateSaved = true;

    for (const asset of assetsToDelete) {
      await deleteFromCloudinary(asset.publicId, asset.resourceType);
    }

    res.status(200).json({ success: true, data: enrichWithOptimizedUrls(updated) });
  } catch (error) {
    if (!updateSaved && req.file && req.file.filename) {
      await deleteFromCloudinary(req.file.filename, req.file.fieldname === "video" ? "video" : "image").catch(() => {});
    }
    next(error);
  }
};

exports.deleteTestimonial = async (req, res, next) => {
  try {
    const testimonial = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
    if (!testimonial) throw new AppError("Testimonial not found", 404);

    const isVideo = testimonial.type === "video";
    const publicId = isVideo
      ? extractPublicIdFromUrl(testimonial.videoUrl)
      : testimonial.imagePublicId || extractPublicIdFromUrl(testimonial.image);

    await prisma.testimonial.delete({ where: { id: req.params.id } });

    if (publicId) {
      await deleteFromCloudinary(publicId, isVideo ? "video" : "image");
    }

    res.status(200).json({ success: true, message: "Testimonial deleted successfully" });
  } catch (error) {
    next(error);
  }
};
