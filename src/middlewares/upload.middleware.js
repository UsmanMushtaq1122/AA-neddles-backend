const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary, getCloudinaryFolder } = require("../utils/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const uploadType = req.uploadType || "products";
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

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|avif/;
  const extname = allowedTypes.test(file.originalname.toLowerCase().split(".").pop());
  const mimetype = allowedTypes.test(file.mimetype);

  if (!extname || !mimetype) {
    return cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp, avif)"), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = upload;
