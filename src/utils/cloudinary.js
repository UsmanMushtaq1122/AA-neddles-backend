const cloudinary = require("cloudinary").v2;
const env = require("../config/env");
const AppError = require("./AppError");

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

const UPLOAD_TIMEOUT = 30000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

const FOLDER_MAP = {
  products: "ecommerce/products",
  categories: "ecommerce/categories",
  banners: "ecommerce/banners",
  testimonials: "ecommerce/testimonials",
};

const getCloudinaryFolder = (uploadType) => {
  return FOLDER_MAP[uploadType] || "ecommerce/products";
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (fn, context) => {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }
  throw new AppError(`Cloudinary ${context} failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`, 500);
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return { result: "not_found" };

  return withRetry(async () => {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      timeout: UPLOAD_TIMEOUT,
    });
    return result;
  }, "delete");
};

const extractPublicIdFromUrl = (url) => {
  if (!url) return null;

  const cloudinaryUrlPattern = /\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp|avif|mp4|webm|mov|m4v)/i;
  const match = url.match(cloudinaryUrlPattern);

  if (match && match[1]) {
    return match[1];
  }

  return null;
};

const generateOptimizedUrl = (publicId, options = {}) => {
  if (!publicId) return null;

  const transformation = [
    { quality: options.quality || "auto" },
    { fetch_format: options.format || "auto" },
  ];

  if (options.width) transformation.push({ width: options.width, crop: options.crop || "limit" });
  if (options.height) transformation.push({ height: options.height, crop: options.crop || "limit" });

  return cloudinary.url(publicId, {
    secure: true,
    transformation,
  });
};

const generateResponsiveUrls = (publicId, breakpoints = [320, 640, 960, 1280, 1920]) => {
  if (!publicId) return {};

  return breakpoints.reduce((acc, width) => {
    acc[`${width}w`] = generateOptimizedUrl(publicId, { width, quality: "auto", format: "auto" });
    return acc;
  }, {});
};

const enrichWithOptimizedUrls = (entity) => {
  if (!entity || !entity.imagePublicId) return entity;
  return {
    ...entity,
    optimizedImage: generateOptimizedUrl(entity.imagePublicId),
    responsiveImages: generateResponsiveUrls(entity.imagePublicId),
  };
};

const enrichArrayWithOptimizedUrls = (entities) =>
  entities.map((e) => enrichWithOptimizedUrls(e));

module.exports = {
  cloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  generateOptimizedUrl,
  generateResponsiveUrls,
  getCloudinaryFolder,
  FOLDER_MAP,
  enrichWithOptimizedUrls,
  enrichArrayWithOptimizedUrls,
};
