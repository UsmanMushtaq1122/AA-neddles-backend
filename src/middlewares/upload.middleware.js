const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary, getCloudinaryFolder } = require("../utils/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req) => {
    const VALID_TYPES = ["products", "categories", "banners", "testimonials", "blogs", "profile"];
    const uploadType = req.uploadType;
    if (!uploadType || !VALID_TYPES.includes(uploadType)) {
      throw new Error(`Invalid upload type "${uploadType}". Allowed: ${VALID_TYPES.join(", ")}`);
    }
    const folder = getCloudinaryFolder(uploadType);
    const entitySlug = req.body?.slug || req.body?.name || "";

    const publicId = entitySlug
      ? `${uploadType}/${entitySlug
          .toString()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}-${Date.now()}`
      : `${uploadType}/${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    return {
      folder,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "avif"],
      transformation: [
        { quality: "auto" },
        { fetch_format: "auto" },
        { width: 2000, height: 2000, crop: "limit" },
      ],
      public_id: publicId,
      timeout: 30000,
    };
  },
});

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req) => {
    const uploadType = req.uploadType;
    if (uploadType !== "testimonials") {
      throw new Error("Video uploads are only allowed for testimonials");
    }
    return {
      folder: getCloudinaryFolder(uploadType),
      resource_type: "video",
      allowed_formats: ["mp4", "webm", "mov", "m4v"],
      public_id: `testimonials/${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      timeout: 120000,
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|avif/;
  const extname = allowedTypes.test(file.originalname.toLowerCase().split(".").pop());
  const mimetype = allowedTypes.test(file.mimetype);

  if (!extname || !mimetype) {
    const err = new Error(
      "Only image files are allowed (jpeg, jpg, png, gif, webp, avif)"
    );
    err.statusCode = 400;
    return cb(err, false);
  }

  cb(null, true);
};

const videoFileFilter = (req, file, cb) => {
  const allowedTypes = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]);
  const allowedExtensions = new Set(["mp4", "webm", "mov", "m4v"]);
  const extension = file.originalname.toLowerCase().split(".").pop();

  if (!allowedTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
    const err = new Error("Only MP4, WebM, MOV, and M4V video files are allowed");
    err.statusCode = 400;
    return cb(err, false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const bannerUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
});

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

const isMultipartRequest = (req) => {
  const contentType = req.headers["content-type"] || "";
  return contentType.toLowerCase().includes("multipart/form-data");
};

const single = (fieldName) => (req, res, next) => {
  if (!isMultipartRequest(req)) {
    return next();
  }
  return upload.single(fieldName)(req, res, next);
};

const singleVideo = (fieldName) => (req, res, next) => {
  if (!isMultipartRequest(req)) {
    return next();
  }
  return videoUpload.single(fieldName)(req, res, next);
};

const array = (fieldName, maxCount) => (req, res, next) => {
  if (!isMultipartRequest(req)) {
    return next();
  }
  return upload.array(fieldName, maxCount)(req, res, next);
};

const fields = (fieldConfigs) => (req, res, next) => {
  if (!isMultipartRequest(req)) {
    return next();
  }
  return upload.fields(fieldConfigs)(req, res, next);
};

const bannerImages = (req, res, next) => {
  if (!isMultipartRequest(req)) {
    return next();
  }
  return bannerUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 },
  ])(req, res, next);
};

module.exports = {
  single,
  singleVideo,
  array,
  fields,
  bannerImages,
};
