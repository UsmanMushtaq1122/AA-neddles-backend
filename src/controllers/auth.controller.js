const authService = require("../services/auth.service");
const AppError = require("../utils/AppError");

exports.register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyOtp(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.resendOtp = async (req, res, next) => {
  try {
    const result = await authService.resendOtp(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.verifyPasswordResetOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyPasswordResetOtp(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const result = await authService.logout(token);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const result = await authService.getMe(req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const result = await authService.changePassword(req.user.id, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Legacy token-based reset (kept for backward compat)
exports.resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body.token, req.body.password);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Legacy token-based email verification (kept for backward compat)
exports.verifyEmail = async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.body.token);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.socialLogin = async (req, res, next) => {
  try {
    const result = await authService.socialLogin(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.checkResetToken = async (req, res, next) => {
  try {
    const token = req.body?.token || req.query?.token;
    if (!token) throw new AppError("Token is required", 400);
    const result = await authService.checkResetToken(token);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
