const env = require("../../config/env");

/**
 * Brand Design Tokens for AA Needles (Pakistani Luxury Women's Fashion)
 */
const BRAND = {
  name: "AA NEEDLES",
  tagline: "Haute Couture & Luxury Pret",
  subheading: "Timeless Elegance & Bespoke Craftsmanship",
  colors: {
    background: "#F8F5F2",       // Soft warm ivory canvas
    secondaryBg: "#E8DDD4",      // Warm stone accent background
    cardBg: "#FFFFFF",           // Crisp white container
    accent: "#C9A27E",           // Luxury gold/bronze accent
    accentDark: "#7A6543",       // Rich antique gold for text
    accentLight: "#F2EBE3",      // Light gold tint for badges
    primaryText: "#1A1A1A",      // Deep charcoal/black
    mutedText: "#6E675F",        // Soft warm gray for secondary copy
    lightText: "#999187",        // Light muted gray for captions
    border: "#E8DDD4",           // Subtle divider
    borderLight: "#F0E8DF",      // Very soft table border
    success: "#2E7D32",          // Deep forest emerald
    successBg: "#E8F5E9",
    warning: "#B45309",          // Warm amber
    warningBg: "#FEF3C7",
    danger: "#991B1B",           // Deep crimson
    dangerBg: "#FEE2E2",
  },
  support: {
    email: "aaneedlesofficial@gmail.com",
    adminEmail: env.ADMIN_EMAIL || "aaneddles@gmail.com",
    phone: "03076916882",
    whatsapp: "923076916882",
    hours: "Monday – Saturday: 10:00 AM – 7:00 PM (PKT)",
  },
};

/**
 * Escapes dynamic text for safe insertion into HTML email templates.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formats monetary amounts consistently as Pakistani Rupees.
 * Example: 15000 -> "PKR 15,000"
 */
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return "PKR 0";
  return `PKR ${num.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Formats dates consistently for Pakistan Standard Time.
 */
function formatDateTime(dateInput) {
  if (!dateInput) return "N/A";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString("en-GB", {
      timeZone: "Asia/Karachi",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " PKT";
  } catch {
    return String(dateInput);
  }
}

function formatDateOnly(dateInput) {
  if (!dateInput) return "N/A";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-GB", {
      timeZone: "Asia/Karachi",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Renders a bulletproof, mobile-friendly CTA button.
 */
function renderButton({ text, url, variant = "primary" }) {
  if (!text || !url) return "";
  const isPrimary = variant === "primary";
  const bg = isPrimary ? BRAND.colors.primaryText : BRAND.colors.accentDark;
  const color = "#FFFFFF";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto; text-align: center;">
      <tr>
        <td align="center" style="border-radius: 3px; background-color: ${bg};">
          <a href="${escapeHtml(url)}" target="_blank" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; font-weight: 600; color: ${color}; text-decoration: none; text-transform: uppercase; letter-spacing: 0.14em; border-radius: 3px;">
            ${escapeHtml(text)} &rarr;
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Renders a luxury status badge.
 */
function renderStatusBadge(status, customLabel) {
  const label = customLabel || status.replace(/_/g, " ");
  let bg = BRAND.colors.accentLight;
  let text = BRAND.colors.accentDark;
  let border = BRAND.colors.accent;

  if (["DELIVERED", "COMPLETED", "PAID"].includes(status)) {
    bg = BRAND.colors.successBg;
    text = BRAND.colors.success;
    border = "#A7F3D0";
  } else if (["CANCELLED", "FAILED"].includes(status)) {
    bg = BRAND.colors.dangerBg;
    text = BRAND.colors.danger;
    border = "#FECACA";
  } else if (["SHIPPED", "OUT_FOR_DELIVERY"].includes(status)) {
    bg = "#EFF6FF";
    text = "#1D4ED8";
    border = "#BFDBFE";
  }

  return `
    <span style="display: inline-block; padding: 4px 14px; border-radius: 20px; background-color: ${bg}; color: ${text}; border: 1px solid ${border}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; line-height: 1.4;">
      ${escapeHtml(label)}
    </span>
  `;
}

/**
 * Extracts a product thumbnail image safely.
 */
function getProductImageUrl(product) {
  if (!product) return null;
  if (Array.isArray(product.images) && product.images.length > 0) {
    const first = product.images[0];
    if (typeof first === "string" && first.startsWith("http")) return first;
    if (first && typeof first === "object" && first.url && first.url.startsWith("http")) return first.url;
  }
  return null;
}

/**
 * Renders the ordered product items in an elegant table.
 */
function renderProductItemsTable(items = [], baseUrl = env.FRONTEND_URL) {
  if (!items || items.length === 0) {
    return `<p style="color: ${BRAND.colors.mutedText}; font-size: 13px; font-style: italic;">No items details available.</p>`;
  }

  const rowsHtml = items.map((item) => {
    const product = item.product || {};
    const name = escapeHtml(product.name || item.name || "Luxury Apparel Item");
    const sku = escapeHtml(product.sku || item.sku || "");
    const qty = Number(item.quantity) || 1;
    const unitPrice = formatCurrency(item.price);
    const itemTotal = formatCurrency(item.total || (Number(item.price) * qty));
    const imageUrl = getProductImageUrl(product);
    const productUrl = product.slug ? `${baseUrl}/product/${encodeURIComponent(product.slug)}` : null;

    const imageHtml = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${name}" width="64" height="74" style="display: block; width: 64px; height: 74px; object-fit: cover; border-radius: 3px; border: 1px solid ${BRAND.colors.border};" />`
      : `<table role="presentation" width="64" height="74" cellpadding="0" cellspacing="0" style="width: 64px; height: 74px; background: ${BRAND.colors.secondaryBg}; border-radius: 3px; border: 1px solid ${BRAND.colors.border}; text-align: center;">
          <tr>
            <td align="center" valign="middle" style="color: ${BRAND.colors.accentDark}; font-family: Georgia, serif; font-size: 18px; font-weight: bold;">
              AA
            </td>
          </tr>
        </table>`;

    return `
      <tr>
        <td style="padding: 14px 10px 14px 0; width: 68px; vertical-align: top;">
          ${imageHtml}
        </td>
        <td style="padding: 14px 10px; vertical-align: top;">
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: ${BRAND.colors.primaryText}; line-height: 1.4;">
            ${productUrl ? `<a href="${escapeHtml(productUrl)}" target="_blank" style="color: ${BRAND.colors.primaryText}; text-decoration: none;">${name}</a>` : name}
          </div>
          ${sku ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: ${BRAND.colors.lightText}; margin-top: 3px; letter-spacing: 0.05em;">SKU: ${sku}</div>` : ""}
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: ${BRAND.colors.mutedText}; margin-top: 4px;">
            Qty: <strong>${qty}</strong> &times; ${unitPrice}
          </div>
        </td>
        <td align="right" style="padding: 14px 0 14px 10px; vertical-align: top; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: ${BRAND.colors.primaryText}; white-space: nowrap;">
          ${itemTotal}
        </td>
      </tr>
      <tr>
        <td colspan="3" style="border-bottom: 1px solid ${BRAND.colors.borderLight}; height: 1px; line-height: 1px; font-size: 1px; padding: 0;">&nbsp;</td>
      </tr>
    `;
  }).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 10px;">
      <thead>
        <tr>
          <th colspan="2" align="left" style="padding-bottom: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: ${BRAND.colors.mutedText}; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid ${BRAND.colors.border};">
            Garment / Item
          </th>
          <th align="right" style="padding-bottom: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: ${BRAND.colors.mutedText}; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid ${BRAND.colors.border};">
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

/**
 * Renders the financial breakdown (Subtotal, Discount, Shipping, COD, Total).
 */
function renderFinancialBreakdown(order) {
  const subtotal = Number(order.subtotal) || 0;
  const shipping = Number(order.shippingCost) || 0;
  const discount = Number(order.discount) || 0;
  const codFee = Number(order.codFee) || 0;
  const total = Number(order.total) || (subtotal - discount + shipping + codFee);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 16px;">
      <tr>
        <td style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText};">
          Subtotal
        </td>
        <td align="right" style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.primaryText};">
          ${formatCurrency(subtotal)}
        </td>
      </tr>

      ${discount > 0 ? `
      <tr>
        <td style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.success};">
          Discount Applied
        </td>
        <td align="right" style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; color: ${BRAND.colors.success};">
          -${formatCurrency(discount)}
        </td>
      </tr>
      ` : ""}

      <tr>
        <td style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText};">
          Shipping &amp; Handling
        </td>
        <td align="right" style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.primaryText};">
          ${shipping === 0 ? '<span style="color: ' + BRAND.colors.success + '; font-weight: 600;">FREE</span>' : formatCurrency(shipping)}
        </td>
      </tr>

      ${codFee > 0 ? `
      <tr>
        <td style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.mutedText};">
          Cash on Delivery Fee
        </td>
        <td align="right" style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.primaryText};">
          ${formatCurrency(codFee)}
        </td>
      </tr>
      ` : ""}

      <tr>
        <td colspan="2" style="padding: 10px 0 6px; border-top: 2px solid ${BRAND.colors.secondaryBg};">&nbsp;</td>
      </tr>

      <tr>
        <td style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 700; color: ${BRAND.colors.primaryText}; text-transform: uppercase; letter-spacing: 0.05em;">
          Total Amount
        </td>
        <td align="right" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 800; color: ${BRAND.colors.accentDark};">
          ${formatCurrency(total)}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Formats shipping address safely into an elegant info card.
 */
function renderShippingAddressCard(address) {
  if (!address) {
    return `<p style="color: ${BRAND.colors.mutedText}; font-size: 13px; margin: 0;">No address details available.</p>`;
  }

  if (typeof address === "string") {
    return `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.primaryText}; line-height: 1.6; margin: 0;">${escapeHtml(address)}</p>`;
  }

  const fullName = [address.firstName, address.lastName].filter(Boolean).join(" ") || address.name || "Valued Customer";
  const line1 = address.addressLine1 || address.line1 || address.address || "";
  const line2 = address.addressLine2 || address.line2 || "";
  const city = address.city || "";
  const province = address.province || address.state || "";
  const postal = address.postalCode || address.zip || "";
  const country = address.country || "Pakistan";
  const phone = address.phone || "";

  const cityLine = [city, province, postal].filter(Boolean).join(", ");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND.colors.primaryText}; line-height: 1.6;">
      <div style="font-weight: 700; color: ${BRAND.colors.primaryText}; margin-bottom: 2px;">${escapeHtml(fullName)}</div>
      ${line1 ? `<div>${escapeHtml(line1)}</div>` : ""}
      ${line2 ? `<div>${escapeHtml(line2)}</div>` : ""}
      ${cityLine ? `<div>${escapeHtml(cityLine)}</div>` : ""}
      <div>${escapeHtml(country)}</div>
      ${phone ? `<div style="margin-top: 4px; color: ${BRAND.colors.mutedText}; font-size: 12px;"><strong>Contact:</strong> ${escapeHtml(phone)}</div>` : ""}
    </div>
  `;
}

/**
 * Renders the Customer Support & Atelier Concierge Box.
 */
function renderSupportBox() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.colors.background}; border: 1px solid ${BRAND.colors.border}; border-radius: 4px; margin: 28px 0 8px; padding: 18px 20px;">
      <tr>
        <td>
          <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 700; color: ${BRAND.colors.primaryText}; margin-bottom: 6px;">
            Need Assistance with Your Order?
          </div>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: ${BRAND.colors.mutedText}; line-height: 1.6;">
            Our client concierge team is available to assist you with sizing, customization, and delivery inquiries.<br />
            <strong>WhatsApp / Helpline:</strong> <a href="https://wa.me/${BRAND.support.whatsapp.replace(/[^0-9]/g, "")}" style="color: ${BRAND.colors.accentDark}; text-decoration: none; font-weight: 600;">${BRAND.support.phone}</a> &bull;
            <strong>Email:</strong> <a href="mailto:${BRAND.support.email}" style="color: ${BRAND.colors.accentDark}; text-decoration: none; font-weight: 600;">${BRAND.support.email}</a><br />
            <span style="font-size: 11px; color: ${BRAND.colors.lightText};">${BRAND.support.hours}</span>
          </div>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Wraps email content inside the shared luxury HTML layout.
 */
function wrapInBaseLayout({ title, preheader = "", contentHtml, baseUrl = env.FRONTEND_URL }) {
  const safeTitle = escapeHtml(title || BRAND.name);
  const publicBaseUrl = (env.FRONTEND_URL || baseUrl || "https://aaneddles.com").replace(/\/$/, "");
  const logoUrl = env.EMAIL_LOGO_URL || `${publicBaseUrl}/logo.png`;
  const trackingPageUrl = `${publicBaseUrl}/order-tracking`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100%; background-color: ${BRAND.colors.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding-left: 18px !important; padding-right: 18px !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; direction: ltr !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.colors.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preheader text hidden in client inbox -->
  <div style="display: none; font-size: 1px; color: ${BRAND.colors.background}; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(preheader)} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.colors.background}; padding: 30px 10px 40px;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; background-color: ${BRAND.colors.cardBg}; border: 1px solid ${BRAND.colors.border}; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">

          <!-- Brand Header -->
          <tr>
            <td align="center" style="background-color: #FFFFFF; padding: 32px 24px 24px; border-bottom: 1px solid ${BRAND.colors.border};">
              <a href="${escapeHtml(publicBaseUrl)}" target="_blank" style="text-decoration: none; display: inline-block;">
                <!-- Brand logo with robust fallback -->
                <img src="${escapeHtml(logoUrl)}" alt="${BRAND.name}" width="160" style="display: block; width: 160px; max-width: 100%; height: auto; margin: 0 auto;" onerror="this.style.display='none'" />
                <h1 style="margin: 6px 0 0; font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${BRAND.colors.primaryText};">
                  ${BRAND.name}
                </h1>
                <p style="margin: 4px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: ${BRAND.colors.accentDark};">
                  ${BRAND.tagline}
                </p>
              </a>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="mobile-padding" style="padding: 32px 36px 24px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Brand Footer -->
          <tr>
            <td style="background-color: #FAF7F4; border-top: 1px solid ${BRAND.colors.border}; padding: 26px 36px; text-align: center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 14px;">
                    <a href="${escapeHtml(publicBaseUrl)}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: ${BRAND.colors.primaryText}; text-decoration: none; margin: 0 10px;">Storefront</a>
                    <span style="color: ${BRAND.colors.border};">&bull;</span>
                    <a href="${escapeHtml(trackingPageUrl)}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: ${BRAND.colors.primaryText}; text-decoration: none; margin: 0 10px;">Track Order</a>
                    <span style="color: ${BRAND.colors.border};">&bull;</span>
                    <a href="${escapeHtml(publicBaseUrl)}/return-exchange-policy" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: ${BRAND.colors.primaryText}; text-decoration: none; margin: 0 10px;">Exchange Policy</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: ${BRAND.colors.lightText}; line-height: 1.6;">
                    &copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.<br />
                    Premium Pakistani Women's Fashion &bull; Ready-to-Wear, Unstitched &amp; Luxury Formals<br />
                    This transactional notification was generated for your order with ${BRAND.name}.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
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
};
