const customerService = require("../services/customer.service");
const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getAllCustomers = async (req, res, next) => {
  try {
    const result = await customerService.getAllCustomers(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getMyProfile = async (req, res, next) => {
  try {
    const result = await customerService.getCustomerProfile(req.user.customerId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getCustomerById = async (req, res, next) => {
  try {
    const result = await customerService.getCustomerById(req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const result = await customerService.updateCustomer(req.params.id, req.body, req.user.role, req.user.customerId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const result = await customerService.deleteCustomer(req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Manually mark a customer's email as verified.
 * Useful when SMTP is not configured or user needs manual override.
 */
exports.manuallyVerifyEmail = async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    if (customer.user.emailVerified) {
      return res.status(200).json({
        success: true,
        data: { message: "Email is already verified.", emailVerified: true },
      });
    }

    await prisma.user.update({
      where: { id: customer.userId },
      data: {
        emailVerified: true,
        otp: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        lastOtpSentAt: null,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        message: `Email for ${customer.email} has been manually verified.`,
        emailVerified: true,
      },
    });
  } catch (error) {
    next(error);
  }
};
