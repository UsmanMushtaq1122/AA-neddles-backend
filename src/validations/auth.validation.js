const Joi = require("joi");

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).{8,}$")).required().messages({
    "string.min": "Password must be at least 8 characters",
    "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  }),
  phone: Joi.string().allow('', null).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).{8,}$")).required().messages({
    "string.min": "Password must be at least 8 characters",
    "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).max(128).pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).{8,}$")).required().messages({
    "string.min": "Password must be at least 8 characters",
    "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  }),
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

const socialLoginSchema = Joi.object({
  provider: Joi.string().valid('google', 'apple').required(),
  credential: Joi.string().required(),
});

// ── OTP Schemas ──────────────────────────────────────────────────────────────

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string()
    .length(4)
    .pattern(/^\d{4}$/)
    .required()
    .messages({
      "string.length": "OTP must be exactly 4 digits",
      "string.pattern.base": "OTP must contain only digits",
    }),
});

const resendOtpSchema = Joi.object({
  email: Joi.string().email().required(),
});

const verifyPasswordResetOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string()
    .length(4)
    .pattern(/^\d{4}$/)
    .required()
    .messages({
      "string.length": "OTP must be exactly 4 digits",
      "string.pattern.base": "OTP must contain only digits",
    }),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).{8,}$"))
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters",
      "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),
});

module.exports = {
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
};
