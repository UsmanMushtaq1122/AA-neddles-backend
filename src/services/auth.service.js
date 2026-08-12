const prisma = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("../utils/jwt");
const AppError = require("../utils/AppError");
const tokenBlacklist = require("../utils/tokenBlacklist");
const { sendEmail } = require("../utils/email");
const { OAuth2Client } = require("google-auth-library");
const {
  generateOtp,
  hashOtp,
  getResendCooldownRemaining,
  sendRegistrationOtpEmail,
  sendPasswordResetOtpEmail,
  validateOtpAttempt,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
} = require("./otp.service");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION — Creates user, sends OTP; does NOT return JWT until verified
// ─────────────────────────────────────────────────────────────────────────────
exports.register = async ({ email, password, name, phone }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError("User with this email already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Generate OTP
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "CUSTOMER",
        emailVerified: false,
        otp: otpHash,
        otpExpiresAt,
        otpAttempts: 0,
        lastOtpSentAt: new Date(),
      },
    });

    const customer = await tx.customer.create({
      data: { email, name, phone: phone || null, userId: user.id },
    });

    return { user, customer };
  });

  // Send OTP email (non-blocking — failure logs silently)
  sendRegistrationOtpEmail(email, name, otp).catch((err) =>
    console.error("Registration OTP email failed:", err.message)
  );

  // Do NOT return token — user must verify OTP first
  return {
    requiresOtpVerification: true,
    email,
    message: `A 4-digit verification code has been sent to ${email}. Please verify your email to continue.`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN — Checks verified status; redirects to OTP if unverified
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { customer: true },
  });

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("Account has been deactivated. Please contact support.", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  // Gate: require email verification before issuing JWT
  if (!user.emailVerified) {
    // Resend OTP automatically so the user can verify
    const cooldownRemaining = getResendCooldownRemaining(user.lastOtpSentAt);
    if (cooldownRemaining === 0) {
      const otp = generateOtp();
      const otpHash = hashOtp(otp);
      const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          otp: otpHash,
          otpExpiresAt,
          otpAttempts: 0,
          lastOtpSentAt: new Date(),
        },
      });

      sendRegistrationOtpEmail(email, user.name, otp).catch((err) =>
        console.error("Login OTP resend email failed:", err.message)
      );
    }

    return {
      requiresOtpVerification: true,
      email,
      message: "Your email is not verified. A new verification code has been sent to your email.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const token = jwt.generateToken({ id: user.id, role: user.role, customerId: user.customer?.id });
  const refreshToken = jwt.generateRefreshToken({ id: user.id, role: user.role, customerId: user.customer?.id });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
    refreshToken,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY OTP — Email verification for registration & re-verification
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyOtp = async ({ email, otp }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { customer: true },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Check attempt limit before checking OTP
  if (user.otpAttempts >= 5) {
    throw new AppError("Too many incorrect attempts. Please request a new OTP.", 429);
  }

  const result = validateOtpAttempt(user, otp);

  if (!result.valid) {
    // Increment failed attempt counter
    await prisma.user.update({
      where: { id: user.id },
      data: { otpAttempts: { increment: 1 } },
    });
    throw new AppError(
      `Incorrect OTP. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} remaining.`,
      400
    );
  }

  // OTP is valid — mark email as verified, clear OTP fields
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      otp: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      lastOtpSentAt: null,
      lastLogin: new Date(),
    },
  });

  const token = jwt.generateToken({ id: user.id, role: user.role, customerId: user.customer?.id });
  const refreshToken = jwt.generateRefreshToken({ id: user.id, role: user.role, customerId: user.customer?.id });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
    refreshToken,
    message: "Email verified successfully!",
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RESEND OTP — Rate-limited OTP resend for email verification
// ─────────────────────────────────────────────────────────────────────────────
exports.resendOtp = async ({ email }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Security: don't leak whether email exists
    return { message: "If an account exists, a new OTP has been sent." };
  }

  if (user.emailVerified) {
    throw new AppError("This email is already verified.", 400);
  }

  const cooldownRemaining = getResendCooldownRemaining(user.lastOtpSentAt);
  if (cooldownRemaining > 0) {
    throw new AppError(
      `Please wait ${cooldownRemaining} second${cooldownRemaining === 1 ? "" : "s"} before requesting a new OTP.`,
      429
    );
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: otpHash,
      otpExpiresAt,
      otpAttempts: 0,
      lastOtpSentAt: new Date(),
    },
  });

  sendRegistrationOtpEmail(email, user.name, otp).catch((err) =>
    console.error("Resend OTP email failed:", err.message)
  );

  return {
    message: `A new verification code has been sent to ${email}.`,
    cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — Sends OTP for password reset (not a link)
// ─────────────────────────────────────────────────────────────────────────────
exports.forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Security: return generic message whether user exists or not
  if (!user) {
    return { message: "If an account exists, a reset code has been sent." };
  }

  // Enforce resend cooldown for forgot password too
  const cooldownRemaining = getResendCooldownRemaining(user.lastOtpSentAt);
  if (cooldownRemaining > 0) {
    throw new AppError(
      `Please wait ${cooldownRemaining} second${cooldownRemaining === 1 ? "" : "s"} before requesting a new code.`,
      429
    );
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: otpHash,
      otpExpiresAt,
      otpAttempts: 0,
      lastOtpSentAt: new Date(),
    },
  });

  try {
    await sendPasswordResetOtpEmail(email, user.name, otp);
  } catch (err) {
    // Rollback OTP on email failure
    await prisma.user.update({
      where: { id: user.id },
      data: { otp: null, otpExpiresAt: null, lastOtpSentAt: null },
    });
    throw new AppError("Failed to send reset code. Please try again later.", 500);
  }

  return {
    message: "If an account exists, a reset code has been sent.",
    requiresOtp: true,
    email,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY RESET OTP + RESET PASSWORD — Combined step for forgot-password flow
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPasswordResetOtp = async ({ email, otp, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError("Invalid request", 400);
  }

  if (user.otpAttempts >= 5) {
    throw new AppError("Too many incorrect attempts. Please request a new code.", 429);
  }

  const result = validateOtpAttempt(user, otp);

  if (!result.valid) {
    await prisma.user.update({
      where: { id: user.id },
      data: { otpAttempts: { increment: 1 } },
    });
    throw new AppError(
      `Incorrect code. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} remaining.`,
      400
    );
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      otp: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      lastOtpSentAt: null,
      // Also mark email as verified if they successfully reset their password
      emailVerified: true,
    },
  });

  return { message: "Password reset successfully. You can now sign in." };
};

// ─────────────────────────────────────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────────────────────────────────────
exports.refreshToken = async (refreshTokenValue) => {
  let decoded;
  try {
    decoded = jwt.verifyRefreshToken(refreshTokenValue);
  } catch (err) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: { customer: true },
  });
  if (!user) {
    throw new AppError("User no longer exists", 401);
  }

  const token = jwt.generateToken({ id: user.id, role: user.role, customerId: user.customer?.id });
  const newRefreshToken = jwt.generateRefreshToken({ id: user.id, role: user.role, customerId: user.customer?.id });

  return { token, refreshToken: newRefreshToken };
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = async (token) => {
  await tokenBlacklist.blacklistToken(token);
  return { message: "Logged out successfully" };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ME
// ─────────────────────────────────────────────────────────────────────────────
exports.getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
  });
  if (!user) throw new AppError("User not found", 404);
  return user;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD
// ─────────────────────────────────────────────────────────────────────────────
exports.changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw new AppError("Current password is incorrect", 401);

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
  return { message: "Password changed successfully" };
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: Token-based verify email (kept for backward compat with old links)
// ─────────────────────────────────────────────────────────────────────────────
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

exports.verifyEmail = async (token) => {
  const tokenHash = hashToken(token);

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError("Invalid or expired verification token", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return { message: "Email verified successfully" };
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: Token-based reset password (kept for backward compat)
// ─────────────────────────────────────────────────────────────────────────────
exports.resetPassword = async (token, newPassword) => {
  const tokenHash = hashToken(token);

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return { message: "Password reset successfully" };
};

exports.checkResetToken = async (token) => {
  const tokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpires: { gt: new Date() },
    },
  });
  return { valid: !!user };
};

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL LOGIN — Google; bypasses OTP (Google already verifies email)
// ─────────────────────────────────────────────────────────────────────────────
exports.socialLogin = async ({ provider, credential }) => {
  let email, name, avatar;

  if (provider === "google") {
    if (!credential) {
      throw new AppError("Google credential is required", 400);
    }
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      avatar = payload.picture;
    } catch (err) {
      throw new AppError("Invalid Google credential", 401);
    }
  } else {
    throw new AppError(`Social login with ${provider} is not supported`, 400);
  }

  if (!email) {
    throw new AppError("Could not retrieve email from Google account", 400);
  }

  let user = await prisma.user.findUnique({
    where: { email },
    include: { customer: true },
  });

  if (!user) {
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          password: hashedPassword,
          role: "CUSTOMER",
          avatar: avatar || null,
          emailVerified: true, // Google verifies email
        },
      });
      await tx.customer.create({
        data: { email, name: name || email.split("@")[0], userId: newUser.id },
      });
      return newUser;
    });
  } else {
    user = await prisma.user.findUnique({
      where: { id: user.id },
      include: { customer: true },
    });
  }

  const token = jwt.generateToken({ id: user.id, role: user.role, customerId: user.customer?.id });
  const refreshToken = jwt.generateRefreshToken({ id: user.id, role: user.role, customerId: user.customer?.id });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
    refreshToken,
  };
};
