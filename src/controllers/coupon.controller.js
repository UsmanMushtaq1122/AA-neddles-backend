const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: coupons });
  } catch (error) {
    next(error);
  }
};

exports.validateCoupon = async (req, res, next) => {
  try {
    const { code, orderTotal } = req.body;
    if (!code) throw new AppError("Coupon code is required", 400);

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!coupon) throw new AppError("Invalid coupon code", 404);
    if (!coupon.isActive) throw new AppError("Coupon is no longer active", 400);
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw new AppError("Coupon has expired", 400);
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError("Coupon usage limit reached", 400);
    }
    if (coupon.minOrderAmount && orderTotal < coupon.minOrderAmount) {
      throw new AppError(
        `Minimum order amount of $${coupon.minOrderAmount} required`,
        400
      );
    }

    let discountAmount = 0;
    if (coupon.type === "PERCENTAGE") {
      discountAmount = (orderTotal * coupon.value) / 100;
      if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    } else {
      discountAmount = Math.min(coupon.value, orderTotal);
    }

    res.status(200).json({
      success: true,
      data: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discountAmount: Math.round(discountAmount * 100) / 100,
        message: "Coupon applied successfully",
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createCoupon = async (req, res, next) => {
  try {
    const { code, value, type, minOrderAmount, maxDiscount, usageLimit, expiresAt, isActive } = req.body;

    const existingCoupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (existingCoupon) {
      throw new AppError("A coupon with this code already exists", 409);
    }

    if (value === undefined || value === null || isNaN(parseFloat(value))) {
      throw new AppError("Coupon value is required and must be a number", 400);
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        value: parseFloat(value),
        type,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive !== false,
      },
    });

    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    next(error);
  }
};

exports.updateCoupon = async (req, res, next) => {
  try {
    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon) throw new AppError("Coupon not found", 404);

    const { code, value, type, minOrderAmount, maxDiscount, usageLimit, expiresAt, isActive } = req.body;
    const data = {};
    if (code) data.code = code.toUpperCase();
    if (value !== undefined) {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) throw new AppError("Value must be a number", 400);
      data.value = parsed;
    }
    if (type) data.type = type;
    if (minOrderAmount !== undefined) data.minOrderAmount = minOrderAmount ? parseFloat(minOrderAmount) : null;
    if (maxDiscount !== undefined) data.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
    if (usageLimit !== undefined) data.usageLimit = usageLimit ? parseInt(usageLimit) : null;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.coupon.update({ where: { id: req.params.id }, data });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon) throw new AppError("Coupon not found", 404);

    await prisma.coupon.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    next(error);
  }
};
