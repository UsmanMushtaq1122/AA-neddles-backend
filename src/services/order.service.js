const prisma = require("../config/db");
const crypto = require("crypto");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");
const logger = require("../config/logger");
const orderEmailService = require("./orderEmail.service");

const VALID_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED"],
  PROCESSING: ["QUALITY_CHECK", "SHIPPED", "CANCELLED"],
  QUALITY_CHECK: ["SHIPPED", "PROCESSING", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "SHIPPED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
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
    include: { items: { include: { product: true } }, customer: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw new AppError("Order not found", 404);

  if (user.role !== "ADMIN" && order.customerId !== user.customerId) {
    throw new AppError("Order not found", 404);
  }

  return {
    ...order,
    validTransitions: VALID_TRANSITIONS[order.status] || [],
  };
};

exports.createOrder = async (orderData, user) => {
  const { items, shippingAddress, paymentMethod, couponCode, deliveryMethod } = orderData;

  const customer = await prisma.customer.findUnique({ where: { id: user.customerId } });
  if (!customer) throw new AppError("Customer profile not found", 404);

  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: "ACTIVE" },
  });

  if (products.length !== productIds.length) {
    throw new AppError("One or more products not found", 404);
  }

  // FIX #1 & #4: Track subtotal, discount, and shippingCost separately
  let subtotal = 0;
  const orderItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const itemTotal = parseFloat(product.price) * item.quantity;
    subtotal += itemTotal;
    return {
      productId: item.productId,
      quantity: item.quantity,
      price: product.price,
      total: parseFloat(itemTotal.toFixed(2)),
    };
  });

  let discountAmount = 0;
  // FIX #2: Use coupon.value instead of coupon.discount
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
    if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date())) {
      throw new AppError("Invalid or expired coupon", 400);
    }
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      throw new AppError(`Minimum order amount for this coupon is PKR ${coupon.minOrderAmount}`, 400);
    }
    if (coupon.type === "PERCENTAGE") {
      discountAmount = Math.min((subtotal * parseFloat(coupon.value)) / 100, coupon.maxDiscount ? parseFloat(coupon.maxDiscount) : Infinity);
    } else {
      discountAmount = parseFloat(coupon.value);
    }
    discountAmount = Math.min(discountAmount, subtotal); // discount can't exceed subtotal
  }

  const DEFAULT_SHIPPING = {
    shippingCost: 199,
    expressShippingCost: 399,
    freeShippingThreshold: 5000,
    codFee: 0,
    codEnabled: true,
  };
  const shippingSetting = await prisma.siteSetting.findUnique({ where: { key: "shipping" } });
  const shipping = { ...DEFAULT_SHIPPING, ...(shippingSetting?.value && typeof shippingSetting.value === "object" ? shippingSetting.value : {}) };

  const isCOD = paymentMethod.toUpperCase() === 'COD';
  const isExpress = deliveryMethod === "express";
  const freeShipping = Number(shipping.freeShippingThreshold) > 0 && subtotal >= Number(shipping.freeShippingThreshold);
  const shippingCost = isExpress
    ? Number(shipping.expressShippingCost) || 0
    : freeShipping
      ? 0
      : Number(shipping.shippingCost) || 0;
  const codFee = isCOD && shipping.codEnabled ? Number(shipping.codFee) || 0 : 0;
  const total = Math.max(0, subtotal - discountAmount + shippingCost + codFee);

  // FIX #1: Generate unique orderNumber before creating the order
  const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const transactionId = `TXN_${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
  const isOnlinePayment = ["card", "easypaisa", "jazzcash", "CARD", "EASYPAISA", "JAZZCASH"].includes(paymentMethod);

  const orderAndPayment = await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const result = await tx.$executeRawUnsafe(
        `UPDATE "Product" SET stock = stock - $1 WHERE id = $2 AND stock >= $1`,
        item.quantity,
        item.productId
      );
      if (result === 0) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });
        throw new AppError(
          `Insufficient stock for "${product?.name || 'item'}". Please try again.`,
          400
        );
      }
    }

    const createdOrder = await tx.order.create({
      data: {
        // FIX #1: Include orderNumber
        orderNumber,
        customerId: customer.id,
        shippingAddress,
        paymentMethod: paymentMethod.toUpperCase(),
        // FIX #4: Persist all financial breakdown fields
        subtotal: parseFloat(subtotal.toFixed(2)),
        shippingCost: parseFloat(shippingCost.toFixed(2)),
        discount: parseFloat(discountAmount.toFixed(2)),
        codFee: parseFloat(codFee.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } }, customer: true },
    });

    const createdPayment = await tx.payment.create({
      data: {
        orderId: createdOrder.id,
        amount: createdOrder.total,
        paymentMethod: paymentMethod.toUpperCase(),
        transactionId,
        status: "PENDING",
      },
    });

    // For online payments, auto-process inside the same transaction
    if (isOnlinePayment) {
      const gatewayResponse = {
        gateway: paymentMethod.toUpperCase(),
        transactionId,
        status: "success",
        processedAt: new Date().toISOString(),
        ...(orderData.mobileNumber ? { mobileNumber: orderData.mobileNumber } : {}),
        ...(orderData.cardLast4 ? { cardLast4: orderData.cardLast4 } : {}),
      };

      await tx.payment.update({
        where: { id: createdPayment.id },
        data: { status: "COMPLETED", gatewayResponse },
      });
      await tx.order.update({
        where: { id: createdOrder.id },
        data: { paymentStatus: "PAID" },
      });

      createdPayment.status = "COMPLETED";
      createdPayment.gatewayResponse = gatewayResponse;
      createdOrder.paymentStatus = "PAID";
    }

    if (couponCode) {
      await tx.coupon.update({
        where: { code: couponCode },
        data: { usedCount: { increment: 1 } },
      });
    }

    return { order: createdOrder, payment: createdPayment };
  });

  const { order, payment } = orderAndPayment;

  // Send Order Confirmation Email via central orderEmailService
  const emailResult = await orderEmailService.sendOrderConfirmation(order);
  const emailStatus = emailResult.ok ? "accepted" : "failed";

  // Record initial lifecycle event in statusHistory
  await orderEmailService.recordStatusHistory({
    orderId: order.id,
    status: "PENDING",
    from: null,
    note: "Order placed successfully by customer",
    notificationResult: emailResult,
    changedBy: user.customerId || user.id || "CUSTOMER",
    changedByRole: "CUSTOMER",
  });

  return { ...order, payment, emailStatus };
};

exports.updateOrderStatus = async (id, status, user = {}, payload = {}) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, payments: { orderBy: { createdAt: "desc" } }, customer: true },
  });
  if (!order) throw new AppError("Order not found", 404);

  const validStatuses = [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "QUALITY_CHECK",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
  ];

  const targetStatus = status ? status.toUpperCase() : "";

  if (!validStatuses.includes(targetStatus)) {
    throw new AppError(
      `Invalid status "${status}". Allowed: ${validStatuses.join(", ")}`,
      400
    );
  }

  // Validate state transitions
  const allowedNext = VALID_TRANSITIONS[order.status] || [];
  if (order.status !== targetStatus && allowedNext.length > 0 && !allowedNext.includes(targetStatus)) {
    throw new AppError(
      `Cannot transition order from "${order.status}" to "${targetStatus}". Allowed next stages: ${allowedNext.join(", ")}`,
      400
    );
  }

  if (order.status === targetStatus) {
    return {
      ...order,
      validTransitions: VALID_TRANSITIONS[order.status] || [],
    };
  }

  const updateData = { status: targetStatus };

  if (payload.trackingNumber) updateData.trackingNumber = payload.trackingNumber;
  if (payload.trackingUrl || payload.url) updateData.trackingUrl = payload.trackingUrl || payload.url;
  if (payload.notes) updateData.internalNotes = payload.notes;

  // If status is updated to DELIVERED, auto-mark paymentStatus as PAID if pending
  if (targetStatus === "DELIVERED" && order.paymentStatus !== "PAID") {
    updateData.paymentStatus = "PAID";
  }

  const shouldCompletePayment = targetStatus === "DELIVERED";

  // Handle stock adjustments when moving to/from CANCELLED
  if (targetStatus === "CANCELLED" && order.status !== "CANCELLED") {
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({ where: { id }, data: updateData });

      if (shouldCompletePayment && order.payments.length > 0) {
        await tx.payment.update({
          where: { id: order.payments[0].id },
          data: {
            status: "COMPLETED",
            gatewayResponse: {
              status: "completed_on_delivery",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }
    });
  } else if (order.status === "CANCELLED" && targetStatus !== "CANCELLED") {
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      await tx.order.update({ where: { id }, data: updateData });

      if (shouldCompletePayment && order.payments.length > 0) {
        await tx.payment.update({
          where: { id: order.payments[0].id },
          data: {
            status: "COMPLETED",
            gatewayResponse: {
              status: "completed_on_delivery",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: updateData });

      if (shouldCompletePayment && order.payments.length > 0) {
        await tx.payment.update({
          where: { id: order.payments[0].id },
          data: {
            status: "COMPLETED",
            gatewayResponse: {
              status: "completed_on_delivery",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }
    });
  }

  const updatedOrder = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: true, payments: { orderBy: { createdAt: "desc" } } },
  });

  // 📧 Send customer email notification for this status transition
  const emailResult = await orderEmailService.sendNotificationForStatus(
    updatedOrder,
    order.status,
    targetStatus,
    payload
  );

  // 📝 Record status change event and email delivery outcome in statusHistory
  const updatedHistory = await orderEmailService.recordStatusHistory({
    orderId: id,
    status: targetStatus,
    from: order.status,
    note: payload.notes || payload.cancellationReason || null,
    notificationResult: emailResult,
    changedBy: user?.id || null,
    changedByRole: user?.role || "ADMIN",
  });

  return {
    ...updatedOrder,
    statusHistory: updatedHistory || updatedOrder.statusHistory,
    emailStatus: emailResult.ok ? "accepted" : "failed",
    validTransitions: VALID_TRANSITIONS[targetStatus] || [],
  };
};

exports.updateOrderNotes = async (id, internalNotes, user = {}) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError("Order not found", 404);

  const updated = await prisma.order.update({
    where: { id },
    data: { internalNotes },
  });

  await orderEmailService.recordStatusHistory({
    orderId: id,
    status: order.status,
    from: order.status,
    note: `Notes updated: ${internalNotes ? internalNotes.slice(0, 100) : "cleared"}`,
    changedBy: user?.id || null,
    changedByRole: user?.role || "ADMIN",
  });

  return updated;
};

exports.updateOrderTracking = async (id, trackingData, user = {}) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError("Order not found", 404);

  const trackingNumber = typeof trackingData === "object" ? trackingData.trackingNumber : trackingData;
  const trackingUrl = typeof trackingData === "object" ? (trackingData.trackingUrl || trackingData.url || null) : null;
  const carrier = typeof trackingData === "object" ? (trackingData.carrier || null) : null;

  const updateData = {};
  if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
  if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;

  const updated = await prisma.order.update({
    where: { id },
    data: updateData,
  });

  await orderEmailService.recordStatusHistory({
    orderId: id,
    status: order.status,
    from: order.status,
    note: `Tracking updated: ${trackingNumber || "N/A"}${carrier ? ` via ${carrier}` : ""}`,
    changedBy: user?.id || null,
    changedByRole: user?.role || "ADMIN",
  });

  return updated;
};

exports.trackOrder = async (orderNumber) => {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      trackingNumber: true,
      trackingUrl: true,
      createdAt: true,
    },
  });
  if (!order) throw new AppError("Order not found", 404);
  return order;
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
