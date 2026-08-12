const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getMyWishlist = async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    if (!customer) throw new AppError("Customer profile not found", 404);
    const items = await prisma.wishlistItem.findMany({
      where: { customerId: customer.id },
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: items.map(i => i.product) });
  } catch (error) { next(error); }
};

exports.toggle = async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    if (!customer) throw new AppError("Customer profile not found", 404);
    const { productId } = req.body;
    const existing = await prisma.wishlistItem.findUnique({
      where: { customerId_productId: { customerId: customer.id, productId } },
    });
    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      return res.json({ success: true, data: { wishlisted: false } });
    }
    await prisma.wishlistItem.create({ data: { customerId: customer.id, productId } });
    res.status(201).json({ success: true, data: { wishlisted: true } });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    if (!customer) throw new AppError("Customer profile not found", 404);
    await prisma.wishlistItem.deleteMany({
      where: { customerId: customer.id, productId: req.params.productId },
    });
    res.json({ success: true, data: { message: "Removed from wishlist" } });
  } catch (error) { next(error); }
};
