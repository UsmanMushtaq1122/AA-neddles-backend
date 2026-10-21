const env = require("../config/env");
const logger = require("../config/logger");
const { transporter, isSmtpConfigured } = require("./email");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a single email with retry + exponential backoff.
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text]
 * @param {string} [opts.from]
 * @param {string} [opts.replyTo]
 * @param {number} [opts.attempts=env.NEWSLETTER_MAX_ATTEMPTS]
 * @returns {Promise<{ok: boolean, attempts: number, error?: string, messageId?: string}>}
 */
async function sendEmailWithRetry({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  attempts = env.NEWSLETTER_MAX_ATTEMPTS,
}) {
  if (!isSmtpConfigured()) {
    return {
      ok: false,
      attempts: 0,
      error: "SMTP not configured (SMTP_HOST/PORT/USER/PASS/EMAIL_FROM missing)",
    };
  }

  const senderFrom = from || `"${env.NEWSLETTER_FROM_NAME || "AA NEEDLES"}" <${env.EMAIL_FROM}>`;
  const mailOptions = {
    from: senderFrom,
    to,
    subject,
    html,
  };
  if (text) mailOptions.text = text;
  if (replyTo) mailOptions.replyTo = replyTo;

  let lastError = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return { ok: true, attempts: attempt, messageId: info?.messageId };
    } catch (err) {
      lastError = err.message || String(err);
      logger.warn(`[email-sender] attempt ${attempt}/${attempts} failed for ${to}: ${lastError}`);
      if (attempt < attempts) {
        await sleep(500 * 2 ** (attempt - 1));
      }
    }
  }
  return { ok: false, attempts, error: lastError };
}

module.exports = { sendEmailWithRetry, sleep };

