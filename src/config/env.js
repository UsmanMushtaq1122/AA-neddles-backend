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
  ADMIN_URL: process.env.ADMIN_URL || "http://localhost:3001",
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  LOW_STOCK_THRESHOLD: parseInt(process.env.LOW_STOCK_THRESHOLD, 10) || 10,
  LOW_STOCK_CRON: process.env.LOW_STOCK_CRON || "0 9 * * *",
  ORDER_REMINDER_CRON: process.env.ORDER_REMINDER_CRON || "0 9 * * *",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "",
  ENABLE_CRON_JOBS: process.env.ENABLE_CRON_JOBS !== "false",
  INVENTORY_SCAN_BATCH_SIZE: parseInt(process.env.INVENTORY_SCAN_BATCH_SIZE, 10) || 500,
  NEWSLETTER_CRON: process.env.NEWSLETTER_CRON || "0 10 * * *",
  NEWSLETTER_BATCH_SIZE: parseInt(process.env.NEWSLETTER_BATCH_SIZE, 10) || 50,
  NEWSLETTER_BATCH_DELAY: parseInt(process.env.NEWSLETTER_BATCH_DELAY, 10) || 3000,
  NEWSLETTER_MAX_ATTEMPTS: parseInt(process.env.NEWSLETTER_MAX_ATTEMPTS, 10) || 3,
  NEWSLETTER_FROM_NAME: process.env.NEWSLETTER_FROM_NAME || "AA NEEDLES",
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

const smtpVars = [env.SMTP_HOST, env.SMTP_PORT, env.SMTP_USER, env.SMTP_PASS, env.EMAIL_FROM];
if (smtpVars.some((v) => !v)) {
  console.warn("WARNING: SMTP environment variables are not fully configured. Email features (password reset, order confirmations) will fail at runtime.");
}

module.exports = env;
