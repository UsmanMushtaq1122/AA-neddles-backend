const prisma = require("../config/db");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");

const VALID_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

exports.getAllOrders = async (query) => {
  const { page = 1, limit = 10, status } = query;
  const skip = pagination.getSkip(page, limit);
  const take = Math.min(parseInt(limit), 100);

  const where = {};
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { product: true } }, customer: true },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page: parseInt(page), totalPages: Math.ceil(total / take) };
};

exports.getOrdersByCustomer = async (customerId, query) => {
  const { page = 1, limit = 10 } = query;
  const skip = pagination.getSkip(page, limit);
  const take = Math.min(parseInt(limit), 100);

  const where = { customerId };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page: parseInt(page), totalPages: Math.ceil(total / take) };
};

exports.getOrderById = async (id, user) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: true },
  });
  if (!order) throw new AppError("Order not found", 404);

  if (user.role !== "ADMIN" && order.customerId !== user.customerId) {
    throw new AppError("Order not found", 404);
  }

  return order;
};

exports.createOrder = async (orderData, user) => {
  const { items, shippingAddress, paymentMethod, couponCode } = orderData;

  const customer = await prisma.customer.findUnique({ where: { id: user.customerId } });
  if (!customer) throw new AppError("Customer profile not found", 404);

  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  if (products.length !== productIds.length) {
    throw new AppError("One or more products not found", 404);
  }

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (product.stock < item.quantity) {
      throw new AppError(
        `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`,
        400
      );
    }
  }

  let total = 0;
  const orderItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const itemTotal = product.price * item.quantity;
    total += itemTotal;
    return {
      productId: item.productId,
      quantity: item.quantity,
      price: product.price,
    };
  });

  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
    if (!coupon || !coupon.isActive || coupon.expiresAt < new Date()) {
      throw new AppError("Invalid or expired coupon", 400);
    }
    if (coupon.minOrderAmount && total < coupon.minOrderAmount) {
      throw new AppError(`Minimum order amount for this coupon is $${coupon.minOrderAmount}`, 400);
    }
    if (coupon.type === "PERCENTAGE") {
      const discount = Math.min((total * coupon.discount) / 100, coupon.maxDiscount || Infinity);
      total -= discount;
    } else {
      total -= coupon.discount;
    }
    total = Math.max(total, 0);
  }

  const order = await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (product.stock < item.quantity) {
        throw new AppError(`Stock changed for "${product.name}". Please try again.`, 400);
      }
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return tx.order.create({
      data: {
        customerId: customer.id,
        shippingAddress,
        paymentMethod,
        total: parseFloat(total.toFixed(2)),
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } }, customer: true },
    });
  });

  return order;
};

exports.updateOrderStatus = async (id, status) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError("Order not found", 404);

  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(status)) {
    throw new AppError(
      `Cannot transition order from "${order.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
      400
    );
  }

  if (status === "CANCELLED") {
    await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId: id } });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({ where: { id }, data: { status } });
    });

    return prisma.order.findUnique({ where: { id }, include: { items: true } });
  }

  return prisma.order.update({ where: { id }, data: { status } });
};

exports.deleteOrder = async (id) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError("Order not found", 404);

  if (order.status !== "PENDING" && order.status !== "CANCELLED") {
    throw new AppError("Only pending or cancelled orders can be deleted", 400);
  }

  await prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({ where: { orderId: id } });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.order.delete({ where: { id } });
  });

  return { message: "Order deleted successfully" };
};
