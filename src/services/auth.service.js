const prisma = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("../utils/jwt");
const AppError = require("../utils/AppError");
const tokenBlacklist = require("../utils/tokenBlacklist");
const { sendEmail } = require("../utils/email");

exports.register = async ({ email, password, name }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError("User with this email already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, password: hashedPassword, name, role: "CUSTOMER" },
    });

    const customer = await tx.customer.create({
      data: { email, name, userId: user.id },
    });

    return { user, customer };
  });

  const token = jwt.generateToken({ id: result.user.id, role: result.user.role, customerId: result.customer.id });
  const refreshToken = jwt.generateRefreshToken({ id: result.user.id, role: result.user.role, customerId: result.customer.id });

  return {
    user: { id: result.user.id, email: result.user.email, name: result.user.name, role: result.user.role },
    token,
    refreshToken,
  };
};

exports.login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { customer: true },
  });
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = jwt.generateToken({ id: user.id, role: user.role, customerId: user.customer?.id });
  const refreshToken = jwt.generateRefreshToken({ id: user.id, role: user.role, customerId: user.customer?.id });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
    refreshToken,
  };
};

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

exports.logout = async (token) => {
  await tokenBlacklist.blacklistToken(token);
  return { message: "Logged out successfully" };
};

exports.getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError("User not found", 404);
  return user;
};

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

exports.forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: "If an account exists, a reset email has been sent" };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = await bcrypt.hash(resetToken, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  try {
    await sendEmail({
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetURL}">Reset Password</a>
        <p>This link expires in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  } catch (err) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: null, passwordResetExpires: null },
    });
    throw new AppError("Failed to send reset email. Please try again later.", 500);
  }

  return { message: "If an account exists, a reset email has been sent" };
};

exports.resetPassword = async (token, newPassword) => {
  const users = await prisma.user.findMany({
    where: {
      passwordResetToken: { not: null },
      passwordResetExpires: { gt: new Date() },
    },
  });

  let validUser = null;
  for (const user of users) {
    const isMatch = await bcrypt.compare(token, user.passwordResetToken);
    if (isMatch) {
      validUser = user;
      break;
    }
  }

  if (!validUser) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: validUser.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return { message: "Password reset successfully" };
};
