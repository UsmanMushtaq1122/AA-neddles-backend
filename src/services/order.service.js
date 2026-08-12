const prisma = require("../config/db");
const crypto = require("crypto");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");
const { sendEmail } = require("../utils/email");

const VALID_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["QUALITY_CHECK", "CANCELLED"],
  QUALITY_CHECK: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
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

  if (customer.email) {
    sendEmail({
      to: customer.email,
      subject: `Order Confirmation #${order.orderNumber || order.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #7A6543; margin: 0;">AA Neddles</h1>
            <p style="color: #666; font-size: 14px; margin-top: 5px;">Order Confirmation</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <h2 style="color: #1A1A1A;">Thank you for your order, ${customer.name}!</h2>
          <p style="color: #555; line-height: 1.6;">
            Your order <strong>#${order.orderNumber || order.id}</strong> has been received and is currently being processed.
          </p>
          <p style="color: #555; line-height: 1.6;">
            <strong>Payment Method:</strong> ${paymentMethod.toUpperCase() === 'COD' ? 'Cash on Delivery' : paymentMethod.toUpperCase()}<br/>
            <strong>Payment Status:</strong> ${isOnlinePayment ? 'Paid ✅' : 'Pay on Delivery'}
          </p>
          
          <h3 style="color: #1A1A1A; margin-top: 20px;">Order Summary</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="border-bottom: 2px solid #eee; text-align: left;">
                <th style="padding: 8px 0; color: #555;">Item</th>
                <th style="padding: 8px 0; color: #555;">Qty</th>
                <th style="padding: 8px 0; color: #555; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 0; color: #333;">${item.product?.name || 'Product'}</td>
                  <td style="padding: 8px 0; color: #333;">${item.quantity}</td>
                  <td style="padding: 8px 0; color: #333; text-align: right;">PKR ${item.price * item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; text-align: right;">
            <p style="font-size: 16px; font-weight: bold; color: #1A1A1A;">Total Amount: PKR ${order.total}</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            If you have any questions regarding your order, please contact customer support.<br/>
            &copy; ${new Date().getFullYear()} AA Neddles. All rights reserved.
          </p>
        </div>
      `,
    }).catch((err) => console.error("Order confirmation email failed to send:", err.message));
  }

  return { ...order, payment };
};

exports.updateOrderStatus = async (id, status) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
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
  ];

  const targetStatus = status ? status.toUpperCase() : "";

  if (!validStatuses.includes(targetStatus)) {
    throw new AppError(
      `Invalid status "${status}". Allowed: ${validStatuses.join(", ")}`,
      400
    );
  }

  if (order.status === targetStatus) {
    return order;
  }

  const updateData = { status: targetStatus };

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
    include: { items: { include: { product: true } }, customer: true },
  });

  // 📧 Send email notification to customer on Status Update
  if (updatedOrder && updatedOrder.customer && updatedOrder.customer.email) {
    let emailSubject = "";
    let emailBody = "";

    const orderNum = updatedOrder.orderNumber || updatedOrder.id;

    if (targetStatus === "CONFIRMED") {
      emailSubject = `Your Order #${orderNum} has been Confirmed! 🎉`;
      emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #7A6543; margin: 0;">AA Neddles</h1>
            <p style="color: #666; font-size: 14px; margin-top: 5px;">Order Confirmation</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <h2 style="color: #1A1A1A;">Order Confirmed!</h2>
          <p style="color: #555; line-height: 1.6;">Dear ${updatedOrder.customer.name},</p>
          <p style="color: #555; line-height: 1.6;">
            Great news! Your order <strong>#${orderNum}</strong> has been officially confirmed by our team and is currently being processed.
          </p>
          <div style="margin: 20px 0; padding: 15px; background: #fafafa; border-radius: 6px;">
            <p style="margin: 5px 0; color: #333;"><strong>Total Amount:</strong> PKR ${updatedOrder.total}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Payment Method:</strong> ${updatedOrder.paymentMethod}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> Confirmed</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            Thank you for shopping with AA Neddles.<br/>
            &copy; ${new Date().getFullYear()} AA Neddles. All rights reserved.
          </p>
        </div>
      `;
    } else if (targetStatus === "SHIPPED") {
      emailSubject = `Your Order #${orderNum} has been Shipped! 🚚`;
      emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #7A6543; margin: 0;">AA Neddles</h1>
            <p style="color: #666; font-size: 14px; margin-top: 5px;">Shipping Update</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <h2 style="color: #1A1A1A;">Your Order is on its Way!</h2>
          <p style="color: #555; line-height: 1.6;">Dear ${updatedOrder.customer.name},</p>
          <p style="color: #555; line-height: 1.6;">
            Your order <strong>#${orderNum}</strong> has been shipped and is on its way to you.
          </p>
          ${updatedOrder.trackingNumber ? `<p style="color: #555; line-height: 1.6;"><strong>Tracking Number:</strong> ${updatedOrder.trackingNumber}</p>` : ''}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            &copy; ${new Date().getFullYear()} AA Neddles. All rights reserved.
          </p>
        </div>
      `;
    } else if (targetStatus === "DELIVERED") {
      emailSubject = `Your Order #${orderNum} has been Delivered! 📦`;
      emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #7A6543; margin: 0;">AA Neddles</h1>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <h2 style="color: #1A1A1A;">Order Delivered!</h2>
          <p style="color: #555; line-height: 1.6;">Dear ${updatedOrder.customer.name},</p>
          <p style="color: #555; line-height: 1.6;">
            Your order <strong>#${orderNum}</strong> has been successfully delivered. We hope you enjoy your purchase!
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            Thank you for choosing AA Neddles.<br/>
            &copy; ${new Date().getFullYear()} AA Neddles. All rights reserved.
          </p>
        </div>
      `;
    } else if (targetStatus === "CANCELLED") {
      emailSubject = `Order #${orderNum} Cancellation Notice`;
      emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #7A6543; margin: 0;">AA Neddles</h1>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <h2 style="color: #1A1A1A;">Order Cancelled</h2>
          <p style="color: #555; line-height: 1.6;">Dear ${updatedOrder.customer.name},</p>
          <p style="color: #555; line-height: 1.6;">
            Your order <strong>#${orderNum}</strong> has been cancelled. If you have any questions, please reach out to customer support.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            &copy; ${new Date().getFullYear()} AA Neddles. All rights reserved.
          </p>
        </div>
      `;
    }

    if (emailSubject) {
      sendEmail({
        to: updatedOrder.customer.email,
        subject: emailSubject,
        html: emailBody,
      }).catch((err) => console.error("Order status update email failed to send:", err.message));
    }
  }

  return updatedOrder;
};

exports.updateOrderNotes = async (id, internalNotes) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError("Order not found", 404);

  return prisma.order.update({
    where: { id },
    data: { internalNotes },
  });
};

exports.updateOrderTracking = async (id, trackingNumber) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError("Order not found", 404);

  return prisma.order.update({
    where: { id },
    data: { trackingNumber },
  });
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
