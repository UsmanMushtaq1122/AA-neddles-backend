const prisma = require("../config/db");
const crypto = require("crypto");
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

exports.verifyPayment = async (paymentId, { status, gatewayResponse }) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError("Payment not found", 404);

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: status === "success" ? "COMPLETED" : "FAILED",
        gatewayResponse: gatewayResponse || null,
      },
    });

    if (status === "success") {
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: "CONFIRMED" },
      });
    }

    return p;
  });

  return updatedPayment;
};

exports.getPaymentByOrder = async (orderId) => {
  const payment = await prisma.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
  return payment || null;
};

exports.getAllPayments = async (query) => {
  const { page = 1, limit = 10, status } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
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
