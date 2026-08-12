function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLowStockAlertSubject({ lowStockCount, outOfStockCount }) {
  const parts = [];
  if (outOfStockCount > 0) parts.push(`${outOfStockCount} out of stock`);
  if (lowStockCount > 0) parts.push(`${lowStockCount} low stock`);
  return `[Inventory Alert] ${parts.join(" / ")} products need attention`;
}

/**
 * @param {object} opts
 * @param {Array} opts.products — alertable entries { product, severity, threshold, stock, categoryName }
 * @param {string} opts.executedAt — ISO timestamp
 * @param {string} opts.baseUrl — storefront base URL for product links
 */
function buildLowStockAlertHtml({ products, executedAt, baseUrl }) {
  const rows = products
    .map(({ product, severity, threshold, stock, categoryName }) => {
      const isCritical = severity === "CRITICAL";
      const productUrl = `${baseUrl}/product/${encodeURIComponent(product.slug)}`;
      const badgeColor = isCritical ? "#dc2626" : "#d97706";
      const badgeText = isCritical ? "OUT OF STOCK" : "LOW STOCK";
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 12px; font-size: 13px; color: #111827;">
            <a href="${productUrl}" style="color: #111827; font-weight: 600; text-decoration: none;">${escapeHtml(product.name)}</a>
          </td>
          <td style="padding: 10px 12px; font-size: 12px; color: #6b7280; font-family: monospace;">${escapeHtml(product.sku)}</td>
          <td style="padding: 10px 12px; font-size: 13px; text-align: center; color: #111827; font-weight: 600;">${stock}</td>
          <td style="padding: 10px 12px; font-size: 13px; text-align: center; color: #374151;">${threshold}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #6b7280;">${escapeHtml(categoryName)}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; background: ${badgeColor}; color: #ffffff; font-size: 10px; font-weight: 700; letter-spacing: 0.05em;">${badgeText}</span>
          </td>
        </tr>`;
    })
    .join("");

  const criticalCount = products.filter((p) => p.severity === "CRITICAL").length;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: #1f2937; padding: 20px 24px;">
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">Inventory Low Stock Alert</p>
              <p style="margin: 4px 0 0; color: #9ca3af; font-size: 12px;">Generated ${new Date(executedAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
                The following <strong>${products.length}</strong> product${products.length === 1 ? "" : "s"} need attention
                (${criticalCount} critical, ${products.length - criticalCount} low).
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e5e7eb;">
                <tr style="background: #f9fafb;">
                  <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Product</th>
                  <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">SKU</th>
                  <th style="padding: 8px 12px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Stock</th>
                  <th style="padding: 8px 12px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Threshold</th>
                  <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Category</th>
                  <th style="padding: 8px 12px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Status</th>
                </tr>
                ${rows}
              </table>
              <p style="margin: 20px 0 0; color: #9ca3af; font-size: 11px; line-height: 1.6;">
                This is an automated digest generated by the inventory monitoring system.
                Duplicate alerts for the same product are suppressed for 24 hours.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { buildLowStockAlertHtml, buildLowStockAlertSubject };
