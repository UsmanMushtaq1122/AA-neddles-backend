const rateLimit = require("express-rate-limit");

// General API limiter — 1000 req / 15 min
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints (register, login, forgot-password, social) — 10 req / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP verification & resend — strict: 5 req / 15 min (brute-force protection)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many OTP attempts. Please wait 15 minutes before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts, including successful ones
});

// File upload limiter — 20 req / 15 min
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many upload attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { limiter, authLimiter, otpLimiter, uploadLimiter };
