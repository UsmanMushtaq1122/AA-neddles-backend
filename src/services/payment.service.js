const prisma = require("../config/db");
const crypto = require("crypto");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");

exports.createPayment = async ({ orderId, amount, paymentMethod, customerId }) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404);

  if (order.customerId !== customerId) {
    throw new AppError("You are not authorized to pay for this order", 403);
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { orderId, status: "COMPLETED" },
  });
  if (existingPayment) {
    throw new AppError("This order has already been paid for", 409);
  }

  const transactionId = `TXN_${crypto.randomBytes(12).toString("hex").toUpperCase()}`;

  const payment = await prisma.payment.create({
    data: {
      orderId,
      amount,
      paymentMethod,
      transactionId,
      status: "PENDING",
    },
  });

  return payment;
};

exports.verifyPayment = async (paymentId, adminUser) => {
  if (!adminUser || (adminUser.role !== "ADMIN" && adminUser.role !== "SUPER_ADMIN")) {
    throw new AppError("Only admins can verify payments", 403);
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError("Payment not found", 404);

  if (payment.status !== "PENDING") {
    throw new AppError("Payment is not in a pending state", 400);
  }

  const gatewayResponse = {
    verifiedBy: adminUser.id,
    gateway: payment.paymentMethod,
    transactionId: payment.transactionId,
    status: "success",
    verifiedAt: new Date().toISOString(),
  };

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "COMPLETED", gatewayResponse },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "CONFIRMED", paymentStatus: "PAID" },
    });

    return p;
  });

  return updatedPayment;
};

exports.getPaymentByOrder = async (orderId, user) => {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true } });
  if (!order) return null;
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && order.customerId !== user.customerId) {
    return null;
  }
  const payment = await prisma.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
  return payment || null;
};

exports.getAllPayments = async (query) => {
  const { page = 1, limit = 10, status } = query;
  const skip = pagination.getSkip(page, limit);
  const take = Math.min(parseInt(limit), 100);

  const where = {};
  if (status) where.status = status;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { order: true },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, total, page: parseInt(page), totalPages: Math.ceil(total / take) };
};

exports.refundPayment = async (paymentId, { amount, reason }) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError("Payment not found", 404);

  if (payment.status !== "COMPLETED") {
    throw new AppError("Only completed payments can be refunded", 400);
  }

  const refundAmt = amount ? parseFloat(amount) : payment.amount;
  if (isNaN(refundAmt) || refundAmt <= 0 || refundAmt > payment.amount) {
    throw new AppError("Invalid refund amount", 400);
  }

  const isPartial = refundAmt < payment.amount;
  const newStatus = isPartial ? "PARTIALLY_REFUNDED" : "REFUNDED";

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        gatewayResponse: {
          refundReason: reason || "Admin refund",
          refundedAmount: refundAmt,
          refundedAt: new Date().toISOString(),
        },
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: newStatus,
      },
    });

    return p;
  });

  return updatedPayment;
};

