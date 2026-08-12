function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildUnsubscribeUrl(baseUrl, token) {
  return `${baseUrl}/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Renders the responsive newsletter email.
 *
 * @param {object} opts
 * @param {object} opts.newsletter      { subject, content, ctaText?, ctaUrl? }
 * @param {object} opts.subscriber      { name?, unsubscribeToken, email }
 * @param {string} opts.baseUrl         storefront base URL
 * @param {string} [opts.fromName]      branding name (defaults to env value)
 */
function renderNewsletterTemplate({ newsletter, subscriber, baseUrl, fromName = "AA NEEDLES" }) {
  const greeting = subscriber.name && subscriber.name.trim()
    ? `Hello ${escapeHtml(subscriber.name.trim())},`
    : "Hello,";

  const ctaBlock = newsletter.ctaText && newsletter.ctaUrl
    ? `
      <tr>
        <td align="center" style="padding: 8px 0 32px;">
          <a href="${escapeHtml(newsletter.ctaUrl)}" target="_blank"
             style="display: inline-block; background: #9f1d2c; color: #ffffff; text-decoration: none;
                    font-size: 14px; font-weight: 700; letter-spacing: 0.08em;
                    padding: 14px 42px; border-radius: 4px;">${escapeHtml(newsletter.ctaText)}</a>
        </td>
      </tr>`
    : "";

  const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, subscriber.unsubscribeToken);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(newsletter.subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="width: 100%; max-width: 600px; background: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header / branding -->
          <tr>
            <td style="background: #1f2937; padding: 24px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.18em;">${escapeHtml(fromName)}</p>
              <p style="margin: 4px 0 0; color: #d1d5db; font-size: 11px; letter-spacing: 0.12em;">LUXURY &amp; PRET COLLECTION</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 28px 8px;">
              <p style="margin: 0 0 16px; color: #111827; font-size: 16px; font-weight: 600;">${greeting}</p>
              <div style="color: #374151; font-size: 14px; line-height: 1.75;">
                ${newsletter.content}
              </div>
            </td>
          </tr>
          ${ctaBlock}
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #111827; font-size: 12px; font-weight: 700; letter-spacing: 0.1em;">AA NEEDLES TEAM</p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.6;">
                You received this email because you subscribed to AA NEEDLES.
                <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
                at any time.
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

module.exports = { renderNewsletterTemplate, buildUnsubscribeUrl };
