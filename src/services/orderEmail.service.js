const prisma = require("../config/db");
const env = require("../config/env");
const logger = require("../config/logger");
const { sendEmailWithRetry, getMailboxAddress } = require("../utils/emailSender");
const { BRAND } = require("../emails/orderEmails/emailLayout");
const {
  buildOrderConfirmationEmail,
  buildOrderProcessingEmail,
  buildOrderShippedEmail,
  buildOrderOutForDeliveryEmail,
  buildOrderDeliveredEmail,
  buildOrderCancelledEmail,
  buildOrderRefundEmail,
  buildOrderStatusUpdateEmail,
} = require("../emails/orderEmails/templates");

/**
 * Validates an email address.
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Extracts and verifies recipient email from order and customer data.
 */
function resolveRecipientEmail(order = {}, customer = {}) {
  const candidate =
    customer.email ||
    order.customer?.email ||
    (typeof order.shippingAddress === "object" ? order.shippingAddress?.email : null);

  if (candidate && isValidEmail(candidate)) {
    return candidate.trim().toLowerCase();
  }
  return null;
}

/**
 * Ensures complete order data (with items, product, and customer) is loaded.
 */
async function ensureFullOrder(orderOrId) {
  if (!orderOrId) return null;

  // If already an order object with customer or shippingAddress and items array, use directly
  if (
    typeof orderOrId === "object" &&
    orderOrId.id &&
    (orderOrId.customer || orderOrId.shippingAddress) &&
    Array.isArray(orderOrId.items)
  ) {
    return orderOrId;
  }

  const id = typeof orderOrId === "object" ? orderOrId.id : orderOrId;
  if (!id) return typeof orderOrId === "object" ? orderOrId : null;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return order || (typeof orderOrId === "object" ? orderOrId : null);
  } catch (err) {
    logger.warn(`[OrderEmail] Could not query DB for full order #${id}: ${err.message}`);
    return typeof orderOrId === "object" ? orderOrId : null;
  }
}

/**
 * Checks if a notification for this status was already successfully dispatched recently (idempotency).
 */
function isNotificationAlreadySent(statusHistory = [], targetStatus, windowMinutes = 15) {
  if (!Array.isArray(statusHistory)) return false;
  const cutoff = Date.now() - windowMinutes * 60 * 1000;

  return statusHistory.some((entry) => {
    const entryStatus = String(entry.status || entry.to || "").toUpperCase();
    const isTarget = entryStatus === String(targetStatus).toUpperCase();
    const sentOk = entry.emailSent === true ||
      entry.notificationStatus === "accepted" ||
      entry.notificationStatus === "sent";
    const entryTime = entry.timestamp || entry.at ? new Date(entry.timestamp || entry.at).getTime() : 0;
    return isTarget && sentOk && entryTime > cutoff;
  });
}

/**
 * Appends a lifecycle / notification event to order.statusHistory in the database.
 */
async function recordStatusHistory({
  orderId,
  status,
  from = null,
  note = null,
  notificationResult = null,
  changedBy = null,
  changedByRole = null,
}) {
  try {
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { statusHistory: true },
    });

    const existingHistory = Array.isArray(currentOrder?.statusHistory)
      ? currentOrder.statusHistory
      : [];

    const nowIso = new Date().toISOString();
    const entry = {
      status: String(status).toUpperCase(),
      to: String(status).toUpperCase(),
      from: from ? String(from).toUpperCase() : null,
      timestamp: nowIso,
      at: nowIso,
      note: note || null,
      changedBy: changedBy || null,
      changedByRole: changedByRole || null,
      emailSent: notificationResult ? notificationResult.ok : null,
      notificationStatus: notificationResult?.status || "skipped",
      notificationError: notificationResult?.error || null,
      providerMessageId: notificationResult?.messageId || null,
    };

    const updatedHistory = [...existingHistory, entry];

    await prisma.order.update({
      where: { id: orderId },
      data: { statusHistory: updatedHistory },
    });

    return updatedHistory;
  } catch (err) {
    logger.error("Failed to append to order statusHistory", {
      orderId,
      status,
      error: err.message,
    });
    return null;
  }
}

/**
 * Internal sender that wraps template generation, retry dispatch, logging, and error safety.
 */
async function sendOrderNotification({
  order,
  customer,
  notificationType,
  buildEmailFn,
  payload = {},
  force = false,
}) {
  const orderNumber = order?.orderNumber || order?.id || "N/A";
  const recipient = resolveRecipientEmail(order, customer);

  if (!recipient) {
    logger.warn(`[OrderEmail] Skipped ${notificationType} email: No valid recipient for order #${orderNumber}`);
    return {
      ok: false,
      status: "skipped",
      attempts: 0,
      recipient: null,
      error: "No valid recipient email address found",
    };
  }

  // Idempotency check unless explicitly forced
  if (!force && isNotificationAlreadySent(order.statusHistory, notificationType)) {
    logger.info(`[OrderEmail] Duplicate notification suppressed for order #${orderNumber} (${notificationType})`);
    return {
      ok: true,
      status: "skipped",
      attempts: 0,
      recipient,
      error: null,
      reason: "duplicate_suppressed",
    };
  }

  let emailData;
  try {
    emailData = buildEmailFn({
      order,
      customer: customer || order.customer,
      baseUrl: env.FRONTEND_URL,
      ...payload,
    });
  } catch (renderError) {
    logger.error(`[OrderEmail] Failed to render ${notificationType} template for #${orderNumber}`, {
      errorCode: renderError.code || "TEMPLATE_RENDER_FAILED",
    });
    return {
      ok: false,
      status: "failed",
      attempts: 0,
      recipient,
      error: `Template rendering failed: ${renderError.message}`,
    };
  }

  try {
    const sendResult = await sendEmailWithRetry({
      to: recipient,
      from: `"${env.EMAIL_FROM_NAME || BRAND.name}" <${getMailboxAddress(env.EMAIL_FROM)}>`,
      replyTo: env.EMAIL_REPLY_TO || getMailboxAddress(env.EMAIL_FROM),
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      attempts: 3,
    });

    const status = sendResult.ok ? "accepted" : "failed";

    if (sendResult.ok) {
      logger.info(`[OrderEmail] Provider accepted ${notificationType} email for order #${orderNumber}`, {
        attempts: sendResult.attempts,
        messageId: sendResult.messageId || undefined,
      });
    } else {
      logger.error(`[OrderEmail] Provider did not accept ${notificationType} email for order #${orderNumber}`, {
        attempts: sendResult.attempts,
        errorCode: sendResult.error,
      });
    }

    return {
      ok: sendResult.ok,
      status,
      attempts: sendResult.attempts,
      recipient,
      messageId: sendResult.messageId,
      error: sendResult.error || null,
    };
  } catch (dispatchError) {
    logger.error(`[OrderEmail] Unexpected error sending ${notificationType} email for #${orderNumber}`, {
      errorCode: dispatchError.code || "EMAIL_DISPATCH_FAILED",
    });
    return {
      ok: false,
      status: "failed",
      attempts: 1,
      recipient,
      error: dispatchError.message,
    };
  }
}

// -----------------------------------------------------------------------------
// PUBLIC SERVICE API
// -----------------------------------------------------------------------------

/**
 * 1. Order Confirmation Email
 */
async function sendOrderConfirmation(orderOrId, options = {}) {
  const order = await ensureFullOrder(orderOrId);
  if (!order) return { ok: false, status: "failed", error: "Order not found" };

  return sendOrderNotification({
    order,
    customer: order.customer,
    notificationType: "CONFIRMED",
    buildEmailFn: buildOrderConfirmationEmail,
    force: options.force,
  });
}

/**
 * 2. Order Processing Email
 */
async function sendOrderProcessing(orderOrId, options = {}) {
  const order = await ensureFullOrder(orderOrId);
  if (!order) return { ok: false, status: "failed", error: "Order not found" };

  return sendOrderNotification({
    order,
    customer: order.customer,
    notificationType: "PROCESSING",
    buildEmailFn: buildOrderProcessingEmail,
    force: options.force,
  });
}

/**
 * 3. Order Shipped Email
 */
async function sendOrderShipped(orderOrId, shipmentInfo = {}, options = {}) {
  const order = await ensureFullOrder(orderOrId);
  if (!order) return { ok: false, status: "failed", error: "Order not found" };

  return sendOrderNotification({
    order,
    customer: order.customer,
    notificationType: "SHIPPED",
    buildEmailFn: buildOrderShippedEmail,
    payload: {
      courier: shipmentInfo.carrier || shipmentInfo.courier,
      trackingNumber: shipmentInfo.trackingNumber || order.trackingNumber,
      trackingUrl: shipmentInfo.trackingUrl || shipmentInfo.url || order.trackingUrl,
    },
    force: options.force,
  });
}

/**
 * 4. Out-for-Delivery Email
 */
async function sendOrderOutForDelivery(orderOrId, deliveryInfo = {}, options = {}) {
  const order = await ensureFullOrder(orderOrId);
  if (!order) return { ok: false, status: "failed", error: "Order not found" };

  return sendOrderNotification({
    order,
    customer: order.customer,
    notificationType: "OUT_FOR_DELIVERY",
    buildEmailFn: buildOrderOutForDeliveryEmail,
    payload: {
      deliveryInstructions: deliveryInfo.deliveryInstructions || deliveryInfo.notes,
    },
    force: options.force,
  });
}

/**
 * 5. Order Delivered Email
 */
async function sendOrderDelivered(orderOrId, options = {}) {
  const order = await ensureFullOrder(orderOrId);
  if (!order) return { ok: false, status: "failed", error: "Order not found" };

  return sendOrderNotification({
    order,
    customer: order.customer,
    notificationType: "DELIVERED",
    buildEmailFn: buildOrderDeliveredEmail,
    force: options.force,
  });
}

/**
 * 6. Order Cancellation Email
 */
async function sendOrderCancelled(orderOrId, cancellationInfo = {}, options = {}) {
  const order = await ensureFullOrder(orderOrId);
  if (!order) return { ok: false, status: "failed", error: "Order not found" };

  return sendOrderNotification({
    order,
    customer: order.customer,
    notificationType: "CANCELLED",
    buildEmailFn: buildOrderCancelledEmail,
    payload: {
      reason: cancellationInfo.reason || cancellationInfo.cancellationReason || cancellationInfo.note,
    },
    force: options.force,
  });
}

/**
 * 7. Order Refund Email
 */
async function sendOrderRefund(orderOrId, payment = null, refundDetails = {}, options = {}) {
  const order = await ensureFullOrder(orderOrId);
  if (!order) return { ok: false, status: "failed", error: "Order not found" };

  return sendOrderNotification({
    order,
    customer: order.customer,
    notificationType: "REFUND",
    buildEmailFn: buildOrderRefundEmail,
    payload: {
      payment: payment || (order.payments && order.payments[0]) || null,
      refundDetails,
    },
    force: options.force,
  });
}

/**
 * 8. Order Status Update Email (generic for QUALITY_CHECK, CONFIRMED, RETURNED, etc.)
 */
async function sendOrderStatusUpdate(orderOrId, previousStatus, newStatus, options = {}) {
  const order = await ensureFullOrder(orderOrId);
  if (!order) return { ok: false, status: "failed", error: "Order not found" };

  return sendOrderNotification({
    order,
    customer: order.customer,
    notificationType: newStatus,
    buildEmailFn: buildOrderStatusUpdateEmail,
    payload: {
      previousStatus,
      newStatus,
      message: options.message || options.note,
    },
    force: options.force,
  });
}

/**
 * Central dispatcher: Routes to the appropriate email template based on order status transition.
 */
async function sendNotificationForStatus(order, previousStatus, newStatus, options = {}) {
  const target = String(newStatus || "").toUpperCase();
  const prev = previousStatus ? String(previousStatus).toUpperCase() : null;

  // Suppress duplicate calls if status is unchanged
  if (prev && prev === target && !options.force) {
    return { ok: true, status: "skipped", reason: "status_unchanged" };
  }

  switch (target) {
    case "CONFIRMED":
      return sendOrderStatusUpdate(order, prev, target, {
        message: "Your order has been officially confirmed by our team and is scheduled for atelier production.",
        ...options,
      });

    case "PROCESSING":
      return sendOrderProcessing(order, options);

    case "QUALITY_CHECK":
      return sendOrderStatusUpdate(order, prev, target, {
        message: "Our master tailors are currently inspecting every seam, embellishment, and stitch to guarantee flawless craftsmanship.",
        ...options,
      });

    case "SHIPPED":
      return sendOrderShipped(order, options, options);

    case "OUT_FOR_DELIVERY":
      return sendOrderOutForDelivery(order, options, options);

    case "DELIVERED":
      return sendOrderDelivered(order, options);

    case "CANCELLED":
      return sendOrderCancelled(order, options, options);

    case "RETURNED":
      return sendOrderStatusUpdate(order, prev, target, {
        message: "We have received your returned parcel at our facility and our team is inspecting the garments for exchange or credit according to our policy.",
        ...options,
      });

    default:
      return sendOrderStatusUpdate(order, prev, target, options);
  }
}

module.exports = {
  isValidEmail,
  resolveRecipientEmail,
  ensureFullOrder,
  recordStatusHistory,
  sendOrderConfirmation,
  sendOrderProcessing,
  sendOrderShipped,
  sendOrderOutForDelivery,
  sendOrderDelivered,
  sendOrderCancelled,
  sendOrderRefund,
  sendOrderStatusUpdate,
  sendNotificationForStatus,
};
