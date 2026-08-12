const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validation.middleware");
const { authLimiter, otpLimiter } = require("../middlewares/rateLimit.middleware");
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  socialLoginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  verifyPasswordResetOtpSchema,
} = require("../validations/auth.validation");

// ── Core Auth ────────────────────────────────────────────────────────────────
router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/refresh-token", authLimiter, authController.refreshToken);
router.post("/logout", authMiddleware, authController.logout);
router.get("/me", authMiddleware, authController.getMe);
router.put("/change-password", authMiddleware, validate(changePasswordSchema), authController.changePassword);

// ── OTP Verification ─────────────────────────────────────────────────────────
router.post("/verify-otp", otpLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post("/resend-otp", authLimiter, validate(resendOtpSchema), authController.resendOtp);

// ── Forgot / Reset Password (OTP-based) ──────────────────────────────────────
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/verify-reset-otp", otpLimiter, validate(verifyPasswordResetOtpSchema), authController.verifyPasswordResetOtp);

// ── Legacy Token-Based (kept for backward compatibility) ─────────────────────
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post("/verify-email", authLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.get("/check-reset-token", authLimiter, authController.checkResetToken);

// ── Social Login ─────────────────────────────────────────────────────────────
router.post("/social", authLimiter, validate(socialLoginSchema), authController.socialLogin);

module.exports = router;
