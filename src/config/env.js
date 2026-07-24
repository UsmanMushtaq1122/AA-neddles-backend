require("dotenv").config();

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  throw new Error("FATAL: JWT_SECRET must be set and at least 32 characters long. Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
}

if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET.length < 32) {
  throw new Error("FATAL: JWT_REFRESH_SECRET must be set and at least 32 characters long.");
}

if (!env.DATABASE_URL) {
  throw new Error("FATAL: DATABASE_URL must be set in environment variables.");
}

if (!env.CLOUDINARY_CLOUD_NAME) {
  throw new Error("FATAL: CLOUDINARY_CLOUD_NAME must be set in environment variables.");
}

if (!env.CLOUDINARY_API_KEY) {
  throw new Error("FATAL: CLOUDINARY_API_KEY must be set in environment variables.");
}

if (!env.CLOUDINARY_API_SECRET) {
  throw new Error("FATAL: CLOUDINARY_API_SECRET must be set in environment variables.");
}

module.exports = env;
