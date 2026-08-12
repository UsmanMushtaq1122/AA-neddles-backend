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
 * @param {number} [opts.attempts=env.NEWSLETTER_MAX_ATTEMPTS]
 * @returns {Promise<{ok: boolean, attempts: number, error?: string}>}
 */
async function sendEmailWithRetry({ to, subject, html, attempts = env.NEWSLETTER_MAX_ATTEMPTS }) {
  if (!isSmtpConfigured()) {
    return {
      ok: false,
      attempts: 0,
      error: "SMTP not configured (SMTP_HOST/PORT/USER/PASS/EMAIL_FROM missing)",
    };
  }

  let lastError = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await transporter.sendMail({
        from: `"${env.NEWSLETTER_FROM_NAME}" <${env.EMAIL_FROM}>`,
        to,
        subject,
        html,
      });
      return { ok: true, attempts: attempt };
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
