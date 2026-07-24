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

exports.createCoupon = async (req, res, next) => {
  try {
    const { code, discount, type, minOrderAmount, maxDiscount, expiresAt, isActive } = req.body;

    const existingCoupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (existingCoupon) {
      throw new AppError("A coupon with this code already exists", 409);
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discount,
        type,
        minOrderAmount,
        maxDiscount,
        expiresAt: new Date(expiresAt),
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

    const updated = await prisma.coupon.update({
      where: { id: req.params.id },
      data: req.body,
    });

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
