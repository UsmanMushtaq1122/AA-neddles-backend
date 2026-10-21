const env = require("../../config/env");
const {
  BRAND,
  escapeHtml,
  formatCurrency,
  formatDateTime,
  formatDateOnly,
  renderButton,
  renderStatusBadge,
  renderProductItemsTable,
  renderFinancialBreakdown,
  renderShippingAddressCard,
  renderSupportBox,
  wrapInBaseLayout,
} = require("./emailLayout");

/**
 * Normalizes customer name and greeting.
 */
function getCustomerGreeting(customer, shippingAddress) {
  const name =
    (customer && customer.name && customer.name.trim()) ||
    (shippingAddress && [shippingAddress.firstName, shippingAddress.lastName].filter(Boolean).join(" ")) ||
    "Valued Customer";
  return escapeHtml(name);
}

/**
 * 1. ORDER CONFIRMATION EMAIL
 * Trigger: When an order is successfully created in the database.
 */
function buildOrderConfirmationEmail({ order, customer, baseUrl = env.FRONTEND_URL }) {
  const orderNumber = order.orderNumber || order.id;
  const greeting = getCustomerGreeting(customer, order.shippingAddress);
  const viewOrderUrl = `${baseUrl}/orders/${order.id}`;
  const trackUrl = `${baseUrl}/order-tracking?orderNumber=${encodeURIComponent(orderNumber)}`;
  const orderDate = formatDateTime(order.createdAt);
  const isOnlinePayment = ["CARD", "EASYPAISA", "JAZZCASH", "BANK_TRANSFER"].includes(
    String(order.paymentMethod || "").toUpperCase()
  );
  const isPaid = order.paymentStatus === "PAID" || order.paymentStatus === "COMPLETED";

  const paymentDisplay = String(order.paymentMethod || "COD").toUpperCase() === "COD"
    ? "Cash on Delivery (Pay upon delivery)"
    : `${order.paymentMethod} (${isPaid ? "Paid in Full ✅" : "Payment Pending"})`;

  const subject = `Order Confirmation #${orderNumber} — ${BRAND.name}`;
  const preheader = `Thank you for your order #${orderNumber}. We have received your request and our atelier is preparing your garments.`;

  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      ${renderStatusBadge(order.status || "CONFIRMED", "Order Placed Successfully")}
      <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 16px 0 8px; letter-spacing: 0.04em;">
        Thank You for Your Order, ${greeting}!
      </h2>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND.colors.mutedText}; line-height: 1.6; max-width: 500px; margin: 0 auto;">
        We are delighted to confirm that your order <strong>#${escapeHtml(orderNumber)}</strong> has been received and logged into our atelier. Each piece is handled with exceptional care and devotion to craft.
      </p>
    </div>

    <!-- Order Metadata Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.colors.background}; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 16px 20px; margin-bottom: 24px;">
      <tr>
        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText}; line-height: 1.8;">
          <div><strong style="color: ${BRAND.colors.primaryText};">Order Reference:</strong> #${escapeHtml(orderNumber)}</div>
          <div><strong style="color: ${BRAND.colors.primaryText};">Order Date:</strong> ${orderDate}</div>
          <div><strong style="color: ${BRAND.colors.primaryText};">Payment Method:</strong> ${escapeHtml(paymentDisplay)}</div>
          <div><strong style="color: ${BRAND.colors.primaryText};">Estimated Delivery:</strong> 3 &ndash; 5 business days across Pakistan</div>
        </td>
      </tr>
    </table>

    <!-- Order Items Table -->
    <div style="margin-bottom: 24px;">
      <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 0 0 12px; letter-spacing: 0.05em; text-transform: uppercase;">
        Order Summary
      </h3>
      ${renderProductItemsTable(order.items, baseUrl)}
      ${renderFinancialBreakdown(order)}
    </div>

    <!-- Shipping Address -->
    <div style="background-color: #FFFFFF; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 18px 20px; margin-bottom: 24px;">
      <h4 style="font-family: 'Playfair Display', Georgia, serif; font-size: 14px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">
        Shipping Destination
      </h4>
      ${renderShippingAddressCard(order.shippingAddress)}
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 28px 0 16px;">
      ${renderButton({ text: "View Order & Track Progress", url: trackUrl, variant: "primary" })}
    </div>

    ${renderSupportBox()}
  `;

  const html = wrapInBaseLayout({
    title: subject,
    preheader,
    contentHtml,
    baseUrl,
  });

  const text = `
${BRAND.name} — ${BRAND.tagline}
ORDER CONFIRMATION

Dear ${greeting},

Thank you for shopping with ${BRAND.name}!
Your order #${orderNumber} has been successfully placed.

Order Reference: #${orderNumber}
Order Date: ${orderDate}
Payment Method: ${paymentDisplay}
Total Amount: ${formatCurrency(order.total)}

ITEMS ORDERED:
${(order.items || []).map((i) => `- ${(i.product && i.product.name) || i.name} (Qty: ${i.quantity}) - ${formatCurrency(i.price)}`).join("\n")}

Subtotal: ${formatCurrency(order.subtotal)}
Discount: -${formatCurrency(order.discount || 0)}
Shipping: ${formatCurrency(order.shippingCost || 0)}
Total: ${formatCurrency(order.total)}

Track your order anytime at:
${trackUrl}

Customer Support:
Email: ${BRAND.support.email}
Phone/WhatsApp: ${BRAND.support.phone}
`.trim();

  return { subject, html, text };
}

/**
 * 2. ORDER PROCESSING EMAIL
 * Trigger: When admin changes order status to PROCESSING.
 */
function buildOrderProcessingEmail({ order, customer, baseUrl = env.FRONTEND_URL }) {
  const orderNumber = order.orderNumber || order.id;
  const greeting = getCustomerGreeting(customer, order.shippingAddress);
  const trackUrl = `${baseUrl}/order-tracking?orderNumber=${encodeURIComponent(orderNumber)}`;
  const subject = `Your Order #${orderNumber} is Being Prepared — ${BRAND.name}`;
  const preheader = `Great news! Order #${orderNumber} is now in production with our tailoring and quality team.`;

  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      ${renderStatusBadge("PROCESSING", "In Production & Preparation")}
      <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 16px 0 8px; letter-spacing: 0.04em;">
        Your Order is in Progress
      </h2>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND.colors.mutedText}; line-height: 1.6; max-width: 500px; margin: 0 auto;">
        Dear <strong>${greeting}</strong>, our atelier team has commenced preparing your order <strong>#${escapeHtml(orderNumber)}</strong>. Each garment undergoes careful finishing and hand-ironing prior to packaging.
      </p>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.colors.background}; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 16px 20px; margin-bottom: 24px;">
      <tr>
        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText}; line-height: 1.8;">
          <div><strong style="color: ${BRAND.colors.primaryText};">Order Reference:</strong> #${escapeHtml(orderNumber)}</div>
          <div><strong style="color: ${BRAND.colors.primaryText};">Current Stage:</strong> Garment Preparation &amp; Quality Staging</div>
          <div><strong style="color: ${BRAND.colors.primaryText};">Expected Dispatch:</strong> Within 24&ndash;48 hours</div>
        </td>
      </tr>
    </table>

    <div style="margin-bottom: 24px;">
      <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 0 0 12px; letter-spacing: 0.05em; text-transform: uppercase;">
        Garments in Preparation
      </h3>
      ${renderProductItemsTable(order.items, baseUrl)}
    </div>

    <div style="text-align: center; margin: 28px 0 16px;">
      ${renderButton({ text: "Check Live Status", url: trackUrl, variant: "primary" })}
    </div>

    ${renderSupportBox()}
  `;

  const html = wrapInBaseLayout({
    title: subject,
    preheader,
    contentHtml,
    baseUrl,
  });

  const text = `
${BRAND.name} — ${BRAND.tagline}
ORDER PROCESSING

Dear ${greeting},

Your order #${orderNumber} is now being prepared by our atelier team.
Current Stage: Garment Preparation & Quality Staging
Expected Dispatch: Within 24-48 hours

Track your order anytime:
${trackUrl}

Customer Support:
Email: ${BRAND.support.email}
Phone/WhatsApp: ${BRAND.support.phone}
`.trim();

  return { subject, html, text };
}

/**
 * 3. ORDER SHIPPED EMAIL
 * Trigger: When admin changes order status to SHIPPED.
 */
function buildOrderShippedEmail({ order, customer, courier, trackingNumber, trackingUrl, baseUrl = env.FRONTEND_URL }) {
  const orderNumber = order.orderNumber || order.id;
  const greeting = getCustomerGreeting(customer, order.shippingAddress);
  const activeCourier = courier || "Standard Courier";
  const activeTracking = trackingNumber || order.trackingNumber || null;
  const storefrontTrackUrl = `${baseUrl}/order-tracking?orderNumber=${encodeURIComponent(orderNumber)}`;
  const directTrackingUrl = trackingUrl || order.trackingUrl || storefrontTrackUrl;
  const isCOD = String(order.paymentMethod || "").toUpperCase() === "COD";

  const subject = `Your Order #${orderNumber} Has Shipped! 🚚 — ${BRAND.name}`;
  const preheader = `Your parcel is on its way! Track your shipment #${orderNumber} via ${activeCourier}.`;

  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      ${renderStatusBadge("SHIPPED", "Dispatched & In Transit")}
      <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 16px 0 8px; letter-spacing: 0.04em;">
        Your Order is On Its Way!
      </h2>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND.colors.mutedText}; line-height: 1.6; max-width: 500px; margin: 0 auto;">
        Dear <strong>${greeting}</strong>, your parcel for order <strong>#${escapeHtml(orderNumber)}</strong> has left our dispatch center and has been handed over to our courier partner.
      </p>
    </div>

    <!-- Tracking Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.colors.background}; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 20px; margin-bottom: 24px;">
      <tr>
        <td>
          <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
            Shipment Information
          </div>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText}; line-height: 1.8;">
            <div><strong style="color: ${BRAND.colors.primaryText};">Courier Service:</strong> ${escapeHtml(activeCourier)}</div>
            ${activeTracking ? `<div><strong style="color: ${BRAND.colors.primaryText};">Tracking Number:</strong> <span style="font-family: monospace; font-size: 14px; color: ${BRAND.colors.primaryText}; font-weight: 700;">${escapeHtml(activeTracking)}</span></div>` : ""}
            <div><strong style="color: ${BRAND.colors.primaryText};">Estimated Delivery:</strong> 1 &ndash; 3 business days</div>
            ${isCOD ? `<div style="margin-top: 8px; padding: 8px 12px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 3px; color: #92400E; font-size: 12px;"><strong>Cash on Delivery Reminder:</strong> Please keep <strong>${formatCurrency(order.total)}</strong> in exact cash ready for the courier rider upon delivery.</div>` : ""}
          </div>
        </td>
      </tr>
    </table>

    <!-- Destination Address -->
    <div style="background-color: #FFFFFF; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 18px 20px; margin-bottom: 24px;">
      <h4 style="font-family: 'Playfair Display', Georgia, serif; font-size: 14px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">
        Delivering To
      </h4>
      ${renderShippingAddressCard(order.shippingAddress)}
    </div>

    <!-- Items summary -->
    <div style="margin-bottom: 24px;">
      <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 0 0 12px; letter-spacing: 0.05em; text-transform: uppercase;">
        Package Contents
      </h3>
      ${renderProductItemsTable(order.items, baseUrl)}
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 28px 0 16px;">
      ${renderButton({
        text: activeTracking ? "Track Your Package" : "View Order Tracking",
        url: directTrackingUrl,
        variant: "primary",
      })}
    </div>

    ${renderSupportBox()}
  `;

  const html = wrapInBaseLayout({
    title: subject,
    preheader,
    contentHtml,
    baseUrl,
  });

  const text = `
${BRAND.name} — ${BRAND.tagline}
ORDER SHIPPED

Dear ${greeting},

Your order #${orderNumber} has been dispatched!
Courier: ${activeCourier}
${activeTracking ? `Tracking Number: ${activeTracking}\n` : ""}
Delivery Address:
${typeof order.shippingAddress === "object" ? JSON.stringify(order.shippingAddress) : order.shippingAddress}

${isCOD ? `Cash on Delivery Reminder: Please keep ${formatCurrency(order.total)} ready for the courier rider.\n` : ""}

Track shipment:
${directTrackingUrl}

Customer Support:
Email: ${BRAND.support.email}
Phone/WhatsApp: ${BRAND.support.phone}
`.trim();

  return { subject, html, text };
}

/**
 * 4. OUT FOR DELIVERY EMAIL
 * Trigger: When order status transitions to OUT_FOR_DELIVERY.
 */
function buildOrderOutForDeliveryEmail({ order, customer, deliveryInstructions, baseUrl = env.FRONTEND_URL }) {
  const orderNumber = order.orderNumber || order.id;
  const greeting = getCustomerGreeting(customer, order.shippingAddress);
  const trackUrl = `${baseUrl}/order-tracking?orderNumber=${encodeURIComponent(orderNumber)}`;
  const isCOD = String(order.paymentMethod || "").toUpperCase() === "COD";

  const subject = `Out for Delivery: Order #${orderNumber} Arrives Today! 📦 — ${BRAND.name}`;
  const preheader = `Your parcel is out with the delivery rider and will arrive today at your doorstep.`;

  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      ${renderStatusBadge("OUT_FOR_DELIVERY", "Out with Courier Rider")}
      <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 16px 0 8px; letter-spacing: 0.04em;">
        Arriving Today!
      </h2>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND.colors.mutedText}; line-height: 1.6; max-width: 500px; margin: 0 auto;">
        Dear <strong>${greeting}</strong>, your parcel for order <strong>#${escapeHtml(orderNumber)}</strong> is out for delivery today with our local rider.
      </p>
    </div>

    <!-- Instructions Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 4px; padding: 18px 20px; margin-bottom: 24px;">
      <tr>
        <td>
          <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 700; color: #166534; margin-bottom: 6px;">
            Delivery Day Tips
          </div>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #15803D; line-height: 1.6;">
            &bull; Expected window: <strong>Standard business hours (10:00 AM &ndash; 7:00 PM)</strong><br />
            &bull; Please keep your contact phone available in case the rider calls for directions.<br />
            ${isCOD ? `&bull; <strong>COD Amount:</strong> Please have <strong>${formatCurrency(order.total)}</strong> ready in cash.` : "&bull; Your order is prepaid &mdash; no payment is required at the door."}
            ${deliveryInstructions ? `<br />&bull; <em>Special instruction:</em> ${escapeHtml(deliveryInstructions)}` : ""}
          </div>
        </td>
      </tr>
    </table>

    <div style="background-color: #FFFFFF; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 18px 20px; margin-bottom: 24px;">
      <h4 style="font-family: 'Playfair Display', Georgia, serif; font-size: 14px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">
        Delivery Address
      </h4>
      ${renderShippingAddressCard(order.shippingAddress)}
    </div>

    <div style="text-align: center; margin: 28px 0 16px;">
      ${renderButton({ text: "Track Rider & Shipment", url: trackUrl, variant: "primary" })}
    </div>

    ${renderSupportBox()}
  `;

  const html = wrapInBaseLayout({
    title: subject,
    preheader,
    contentHtml,
    baseUrl,
  });

  const text = `
${BRAND.name} — ${BRAND.tagline}
OUT FOR DELIVERY

Dear ${greeting},

Your order #${orderNumber} is out for delivery today!
Expected window: Standard business hours (10:00 AM - 7:00 PM)
${isCOD ? `Please have ${formatCurrency(order.total)} cash ready for the courier rider.\n` : ""}

Track shipment:
${trackUrl}

Customer Support:
Email: ${BRAND.support.email}
Phone/WhatsApp: ${BRAND.support.phone}
`.trim();

  return { subject, html, text };
}

/**
 * 5. ORDER DELIVERED EMAIL
 * Trigger: When order status transitions to DELIVERED.
 */
function buildOrderDeliveredEmail({ order, customer, baseUrl = env.FRONTEND_URL }) {
  const orderNumber = order.orderNumber || order.id;
  const greeting = getCustomerGreeting(customer, order.shippingAddress);
  const orderDetailsUrl = `${baseUrl}/orders/${order.id}`;

  const subject = `Delivered: Your AA Needles Order #${orderNumber} Has Arrived! ✨`;
  const preheader = `Your parcel has been delivered! We hope you love your new luxury ensemble.`;

  // Provide product review links if items exist
  const reviewItemsHtml = (order.items || []).map((item) => {
    const product = item.product || {};
    const name = escapeHtml(product.name || item.name || "Item");
    const productUrl = product.slug ? `${baseUrl}/product/${encodeURIComponent(product.slug)}` : null;

    return `
      <div style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.borderLight}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px;">
        <span style="font-weight: 600; color: ${BRAND.colors.primaryText};">${name}</span>
        ${productUrl ? `&mdash; <a href="${escapeHtml(productUrl)}" target="_blank" style="color: ${BRAND.colors.accentDark}; text-decoration: underline; font-weight: 600;">Leave a Review &rarr;</a>` : ""}
      </div>
    `;
  }).join("");

  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      ${renderStatusBadge("DELIVERED", "Delivered Successfully")}
      <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 16px 0 8px; letter-spacing: 0.04em;">
        Package Delivered!
      </h2>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND.colors.mutedText}; line-height: 1.6; max-width: 500px; margin: 0 auto;">
        Dear <strong>${greeting}</strong>, our courier has confirmed delivery of your order <strong>#${escapeHtml(orderNumber)}</strong>. It has been a true privilege crafting these pieces for you.
      </p>
    </div>

    <!-- Review Invitation Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.colors.background}; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 22px 24px; margin-bottom: 24px;">
      <tr>
        <td align="center">
          <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin-bottom: 6px;">
            How Did We Do?
          </div>
          <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText}; line-height: 1.6; margin: 0 0 16px;">
            Your feedback inspires our artisans and assists fellow patrons in making exquisite choices. Click below to rate and review your purchased garments:
          </p>
          <div style="text-align: left; background: #FFFFFF; border: 1px solid ${BRAND.colors.borderLight}; border-radius: 3px; padding: 12px 16px; margin-bottom: 12px;">
            ${reviewItemsHtml || '<p style="margin: 0; font-size: 12px; color: #888;">Review available on our storefront.</p>'}
          </div>
        </td>
      </tr>
    </table>

    <!-- Return & Exchange Notice -->
    <div style="background-color: #FFFFFF; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 16px 20px; margin-bottom: 24px;">
      <h4 style="font-family: 'Playfair Display', Georgia, serif; font-size: 13px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em;">
        Fitting &amp; Exchange Assistance
      </h4>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: ${BRAND.colors.mutedText}; line-height: 1.6; margin: 0;">
        If you require a size adjustment or have questions regarding garment care, please visit our <a href="${escapeHtml(baseUrl)}/return-exchange-policy" target="_blank" style="color: ${BRAND.colors.accentDark}; text-decoration: underline;">Exchange Policy</a> within 7 days of delivery.
      </p>
    </div>

    <div style="text-align: center; margin: 28px 0 16px;">
      ${renderButton({ text: "View Order Details", url: orderDetailsUrl, variant: "primary" })}
    </div>

    ${renderSupportBox()}
  `;

  const html = wrapInBaseLayout({
    title: subject,
    preheader,
    contentHtml,
    baseUrl,
  });

  const text = `
${BRAND.name} — ${BRAND.tagline}
ORDER DELIVERED

Dear ${greeting},

Your order #${orderNumber} has been successfully delivered!
We hope you love your new ensemble.

Review your purchased items:
${(order.items || []).map((i) => `- ${(i.product && i.product.name) || i.name}: ${baseUrl}/product/${(i.product && i.product.slug) || ""}`).join("\n")}

View your order:
${orderDetailsUrl}

Customer Support:
Email: ${BRAND.support.email}
Phone/WhatsApp: ${BRAND.support.phone}
`.trim();

  return { subject, html, text };
}

/**
 * 6. ORDER CANCELLATION EMAIL
 * Trigger: When order status transitions to CANCELLED.
 */
function buildOrderCancelledEmail({ order, customer, reason, baseUrl = env.FRONTEND_URL }) {
  const orderNumber = order.orderNumber || order.id;
  const greeting = getCustomerGreeting(customer, order.shippingAddress);
  const isPaid = order.paymentStatus === "PAID" || order.paymentStatus === "COMPLETED";
  const isCOD = String(order.paymentMethod || "").toUpperCase() === "COD";

  const subject = `Order #${orderNumber} Cancellation Notice — ${BRAND.name}`;
  const preheader = `Notice: Order #${orderNumber} has been cancelled. Details regarding payment and refund status are enclosed.`;

  let paymentExplanation = "";
  if (isCOD) {
    paymentExplanation = `Since this order was scheduled for <strong>Cash on Delivery</strong>, no charges were processed and no refund is necessary.`;
  } else if (isPaid) {
    paymentExplanation = `As this order was prepaid via <strong>${escapeHtml(order.paymentMethod)}</strong>, our finance team has initiated a refund review. A formal refund confirmation receipt will be sent as soon as your reversal is processed.`;
  } else {
    paymentExplanation = `No completed payment was recorded for this order. No charges were made to your account.`;
  }

  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      ${renderStatusBadge("CANCELLED", "Order Cancelled")}
      <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 16px 0 8px; letter-spacing: 0.04em;">
        Order Cancellation Notification
      </h2>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND.colors.mutedText}; line-height: 1.6; max-width: 500px; margin: 0 auto;">
        Dear <strong>${greeting}</strong>, this is to inform you that order <strong>#${escapeHtml(orderNumber)}</strong> has been cancelled.
      </p>
    </div>

    <!-- Cancellation details -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.colors.background}; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 18px 20px; margin-bottom: 24px;">
      <tr>
        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText}; line-height: 1.8;">
          <div><strong style="color: ${BRAND.colors.primaryText};">Order Reference:</strong> #${escapeHtml(orderNumber)}</div>
          ${reason ? `<div><strong style="color: ${BRAND.colors.primaryText};">Reason for Cancellation:</strong> ${escapeHtml(reason)}</div>` : ""}
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${BRAND.colors.border};">
            <strong style="color: ${BRAND.colors.primaryText};">Payment &amp; Refund Status:</strong><br />
            ${paymentExplanation}
          </div>
        </td>
      </tr>
    </table>

    <div style="margin-bottom: 24px;">
      <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 0 0 12px; letter-spacing: 0.05em; text-transform: uppercase;">
        Cancelled Garments
      </h3>
      ${renderProductItemsTable(order.items, baseUrl)}
    </div>

    <div style="text-align: center; margin: 28px 0 16px;">
      ${renderButton({ text: "Explore Other Collections", url: baseUrl, variant: "primary" })}
    </div>

    ${renderSupportBox()}
  `;

  const html = wrapInBaseLayout({
    title: subject,
    preheader,
    contentHtml,
    baseUrl,
  });

  const text = `
${BRAND.name} — ${BRAND.tagline}
ORDER CANCELLATION

Dear ${greeting},

Your order #${orderNumber} has been cancelled.
${reason ? `Reason: ${reason}\n` : ""}
Payment & Refund Status:
${paymentExplanation.replace(/<[^>]+>/g, "")}

Cancelled Items:
${(order.items || []).map((i) => `- ${(i.product && i.product.name) || i.name} (Qty: ${i.quantity})`).join("\n")}

If you have questions or wish to place a new order:
Email: ${BRAND.support.email}
Phone/WhatsApp: ${BRAND.support.phone}
`.trim();

  return { subject, html, text };
}

/**
 * 7. ORDER REFUND EMAIL
 * Trigger: When refund is successfully processed via payment.service.js:refundPayment.
 */
function buildOrderRefundEmail({ order, customer, payment, refundDetails = {}, baseUrl = env.FRONTEND_URL }) {
  const orderNumber = order.orderNumber || order.id;
  const greeting = getCustomerGreeting(customer, order.shippingAddress);
  const refundAmount = formatCurrency(refundDetails.amount || payment?.amount || order.total);
  const reason = refundDetails.reason || "Customer resolution or return";
  const refundStatus = refundDetails.status || "COMPLETED";
  const paymentMethod = payment?.paymentMethod || order.paymentMethod || "Original Payment Method";
  const transactionId = payment?.transactionId || refundDetails.transactionId || "N/A";

  const subject = `Refund Processed for Order #${orderNumber} — ${BRAND.name}`;
  const preheader = `A refund of ${refundAmount} has been processed for your order #${orderNumber}.`;

  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      ${renderStatusBadge("COMPLETED", "Refund Processed")}
      <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 16px 0 8px; letter-spacing: 0.04em;">
        Refund Confirmation
      </h2>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND.colors.mutedText}; line-height: 1.6; max-width: 500px; margin: 0 auto;">
        Dear <strong>${greeting}</strong>, we have successfully processed a refund for order <strong>#${escapeHtml(orderNumber)}</strong>.
      </p>
    </div>

    <!-- Refund Details Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.colors.background}; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 20px; margin-bottom: 24px;">
      <tr>
        <td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText}; line-height: 1.8;">
                <div><strong style="color: ${BRAND.colors.primaryText};">Order Reference:</strong> #${escapeHtml(orderNumber)}</div>
                <div><strong style="color: ${BRAND.colors.primaryText};">Refund Amount:</strong> <span style="color: ${BRAND.colors.success}; font-size: 16px; font-weight: 800;">${refundAmount}</span></div>
                <div><strong style="color: ${BRAND.colors.primaryText};">Refund Status:</strong> Completed / Successfully Issued</div>
                <div><strong style="color: ${BRAND.colors.primaryText};">Reversal Method:</strong> ${escapeHtml(paymentMethod)}</div>
                <div><strong style="color: ${BRAND.colors.primaryText};">Transaction Reference:</strong> <span style="font-family: monospace;">${escapeHtml(transactionId)}</span></div>
                ${reason ? `<div><strong style="color: ${BRAND.colors.primaryText};">Notes / Reason:</strong> ${escapeHtml(reason)}</div>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Bank Processing Timeline Note -->
    <div style="background-color: #FFFFFF; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 16px 20px; margin-bottom: 24px;">
      <h4 style="font-family: 'Playfair Display', Georgia, serif; font-size: 13px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em;">
        Processing Timeframe Note
      </h4>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: ${BRAND.colors.mutedText}; line-height: 1.6; margin: 0;">
        While we process reversals immediately, banking institutions in Pakistan typically post the funds to your account or statement within <strong>3 to 7 business days</strong>. If you do not see the credit after 7 business days, please contact your issuing bank referencing the transaction ID above.
      </p>
    </div>

    ${renderSupportBox()}
  `;

  const html = wrapInBaseLayout({
    title: subject,
    preheader,
    contentHtml,
    baseUrl,
  });

  const text = `
${BRAND.name} — ${BRAND.tagline}
REFUND NOTIFICATION

Dear ${greeting},

A refund has been processed for your order #${orderNumber}.
Refunded Amount: ${refundAmount}
Status: Completed
Method: ${paymentMethod}
Transaction ID: ${transactionId}
${reason ? `Reason: ${reason}\n` : ""}

Banking institutions typically reflect the credit within 3 to 7 business days.

Customer Support:
Email: ${BRAND.support.email}
Phone/WhatsApp: ${BRAND.support.phone}
`.trim();

  return { subject, html, text };
}

/**
 * 8. ORDER STATUS UPDATE EMAIL
 * Trigger: When order status transitions to other customer-relevant statuses (e.g. QUALITY_CHECK, CONFIRMED, RETURNED).
 */
function buildOrderStatusUpdateEmail({ order, customer, previousStatus, newStatus, message, baseUrl = env.FRONTEND_URL }) {
  const orderNumber = order.orderNumber || order.id;
  const greeting = getCustomerGreeting(customer, order.shippingAddress);
  const trackUrl = `${baseUrl}/order-tracking?orderNumber=${encodeURIComponent(orderNumber)}`;

  const STATUS_DESCRIPTIONS = {
    CONFIRMED: "Your order has been officially verified by our team and is scheduled for atelier production.",
    QUALITY_CHECK: "Our master tailors are conducting a meticulous quality audit of every stitch, hem, and embellishment on your garments to guarantee perfection.",
    RETURNED: "We have received the returned parcel at our facility and our team is inspecting the items for exchange or settlement according to our policy.",
  };

  const statusLabel = (newStatus || "UPDATED").replace(/_/g, " ");
  const explanation = message || STATUS_DESCRIPTIONS[newStatus] || `Your order status has been updated to ${statusLabel}.`;

  const subject = `Order #${orderNumber} Status Update: ${statusLabel} — ${BRAND.name}`;
  const preheader = `Your order #${orderNumber} has moved to status: ${statusLabel}.`;

  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      ${renderStatusBadge(newStatus, statusLabel)}
      <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin: 16px 0 8px; letter-spacing: 0.04em;">
        Status Update: ${escapeHtml(statusLabel)}
      </h2>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND.colors.mutedText}; line-height: 1.6; max-width: 500px; margin: 0 auto;">
        Dear <strong>${greeting}</strong>, we would like to inform you that your order <strong>#${escapeHtml(orderNumber)}</strong> has progressed to the next stage.
      </p>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.colors.background}; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; padding: 18px 20px; margin-bottom: 24px;">
      <tr>
        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText}; line-height: 1.8;">
          <div><strong style="color: ${BRAND.colors.primaryText};">Order Reference:</strong> #${escapeHtml(orderNumber)}</div>
          ${previousStatus ? `<div><strong style="color: ${BRAND.colors.primaryText};">Previous Stage:</strong> ${escapeHtml(previousStatus.replace(/_/g, " "))}</div>` : ""}
          <div><strong style="color: ${BRAND.colors.primaryText};">Current Stage:</strong> <span style="color: ${BRAND.colors.accentDark}; font-weight: 700;">${escapeHtml(statusLabel)}</span></div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${BRAND.colors.border}; color: ${BRAND.colors.primaryText};">
            ${escapeHtml(explanation)}
          </div>
        </td>
      </tr>
    </table>

    <div style="text-align: center; margin: 28px 0 16px;">
      ${renderButton({ text: "Track Order Progress", url: trackUrl, variant: "primary" })}
    </div>

    ${renderSupportBox()}
  `;

  const html = wrapInBaseLayout({
    title: subject,
    preheader,
    contentHtml,
    baseUrl,
  });

  const text = `
${BRAND.name} — ${BRAND.tagline}
ORDER STATUS UPDATE

Dear ${greeting},

Your order #${orderNumber} has been updated to: ${statusLabel}.
${explanation}

Track your order anytime:
${trackUrl}

Customer Support:
Email: ${BRAND.support.email}
Phone/WhatsApp: ${BRAND.support.phone}
`.trim();

  return { subject, html, text };
}

module.exports = {
  buildOrderConfirmationEmail,
  buildOrderProcessingEmail,
  buildOrderShippedEmail,
  buildOrderOutForDeliveryEmail,
  buildOrderDeliveredEmail,
  buildOrderCancelledEmail,
  buildOrderRefundEmail,
  buildOrderStatusUpdateEmail,
};
