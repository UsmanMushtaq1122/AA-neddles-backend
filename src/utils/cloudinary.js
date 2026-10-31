const cloudinary = require("cloudinary").v2;
const env = require("../config/env");
const logger = require("../config/logger");
const AppError = require("./AppError");
const { Readable } = require("stream");

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

const UPLOAD_TIMEOUT = 60000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRYABLE_NETWORK_ERRORS = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNREFUSED",
]);

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

const uploadImageBuffer = async (buffer, uploadType = "banners") => {
  const folder = getCloudinaryFolder(uploadType);
  const publicId = `${uploadType}/${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: publicId,
            overwrite: true,
            resource_type: "image",
            allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "avif"],
            transformation: [
              { quality: "auto" },
              { fetch_format: "auto" },
              { width: 2000, height: 2000, crop: "limit" },
            ],
            timeout: UPLOAD_TIMEOUT,
          },
          (error, response) => {
            if (error) reject(error);
            else resolve(response);
          }
        );

        const source = Readable.from([buffer]);
        source.on("error", reject);
        uploadStream.on("error", reject);
        source.pipe(uploadStream);
      });

      return {
        path: result.secure_url,
        filename: result.public_id,
        size: result.bytes,
      };
    } catch (error) {
      lastError = error;
      const statusCode = Number(error.http_code);
      const retryable =
        RETRYABLE_NETWORK_ERRORS.has(error.code) ||
        !statusCode ||
        statusCode === 408 ||
        statusCode === 429 ||
        statusCode >= 500;

      if (!retryable || attempt === MAX_RETRIES) break;
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
    }
  }

  console.error("Cloudinary original upload error:", {
    message: lastError?.message,
    http_code: lastError?.http_code,
    name: lastError?.name,
  });

  logger.error("Cloudinary banner image upload failed", {
    uploadType,
    code: lastError?.code,
    statusCode: lastError?.http_code,
    message: lastError?.message,
    attempts: MAX_RETRIES + 1,
  });

  const isConfigurationError = [401, 403].includes(Number(lastError?.http_code));
  throw new AppError(
    isConfigurationError
      ? "Cloudinary rejected the upload. Verify the server Cloudinary credentials and try again."
      : "Cloudinary is temporarily unavailable. The banner was not saved; please try again.",
    isConfigurationError ? 502 : 503
  );
};

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

const getPlayableVideoUrl = (url) => {
  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) return url;

  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "video",
    format: "mp4",
    transformation: [{ quality: "auto" }],
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
  uploadImageBuffer,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  getPlayableVideoUrl,
  generateOptimizedUrl,
  generateResponsiveUrls,
  getCloudinaryFolder,
  FOLDER_MAP,
  enrichWithOptimizedUrls,
  enrichArrayWithOptimizedUrls,
};
