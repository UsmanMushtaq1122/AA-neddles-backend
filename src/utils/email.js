const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../config/logger");

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  requireTLS: env.SMTP_PORT !== 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: true },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

const isSmtpConfigured = () =>
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);

function getMailboxAddress(value) {
  if (!value) return "";
  const match = String(value).match(/<([^<>]+)>/);
  return (match ? match[1] : value).trim();
}

function formatFromAddress(value) {
  const address = getMailboxAddress(value);
  const name = String(env.EMAIL_FROM_NAME || "AA NEEDLES").replace(/["\\]/g, "");
  return `"${name}" <${address}>`;
}

async function verifyTransporter() {
  if (!isSmtpConfigured()) {
    logger.warn("SMTP is not fully configured; email sending is disabled");
    return false;
  }

  try {
    await transporter.verify();
    logger.info("SMTP connection verified");
    return true;
  } catch (error) {
    logger.error("SMTP connection verification failed", {
      code: error.code || "SMTP_VERIFY_FAILED",
      responseCode: error.responseCode || null,
    });
    return false;
  }
}

function htmlToText(html = "") {
  return String(html)
    .replace(/<(head|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isRetryableError(error) {
  const transientNetworkCodes = new Set([
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EAI_AGAIN",
  ]);
  const responseCode = Number(error.responseCode);
  return transientNetworkCodes.has(error.code) ||
    (responseCode >= 400 && responseCode < 500);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    return { ok: false, status: "failed", attempts: 0, error: "smtp_not_configured" };
  }

  const maxAttempts = Math.max(1, Math.min(Number(attempts) || 1, 5));
  const message = {
    from: from || formatFromAddress(env.EMAIL_FROM),
    to,
    subject,
    html,
    text: text || htmlToText(html),
    replyTo: replyTo || env.EMAIL_REPLY_TO || getMailboxAddress(env.EMAIL_FROM),
  };

  if (env.EMAIL_RETURN_PATH) {
    message.envelope = { from: getMailboxAddress(env.EMAIL_RETURN_PATH), to };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const info = await transporter.sendMail(message);
      const acceptedRecipients = Array.isArray(info?.accepted) ? info.accepted : null;
      const rejectedRecipients = Array.isArray(info?.rejected) ? info.rejected : [];
      const allRecipientsRejected = acceptedRecipients
        ? acceptedRecipients.length === 0
        : rejectedRecipients.length > 0;
      if (allRecipientsRejected) {
        const rejectedErrors = Array.isArray(info?.rejectedErrors) ? info.rejectedErrors : [];
        const retryableRejection = rejectedErrors.find(isRetryableError);
        if (retryableRejection && attempt < maxAttempts) {
          logger.warn("Email provider temporarily rejected all recipients", {
            attempt,
            maxAttempts,
            responseCode: retryableRejection.responseCode || null,
          });
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }
        logger.warn("Email provider rejected all recipients for a message", {
          attempt,
          maxAttempts,
          code: "recipient_rejected",
        });
        return {
          ok: false,
          status: "failed",
          attempts: attempt,
          error: "recipient_rejected",
        };
      }
      return {
        ok: true,
        status: "accepted",
        attempts: attempt,
        messageId: info?.messageId || null,
      };
    } catch (error) {
      const retryable = isRetryableError(error);
      logger.warn("Email provider rejected or failed to accept a message", {
        attempt,
        maxAttempts,
        retryable,
        code: error.code || "SMTP_SEND_FAILED",
        responseCode: error.responseCode || null,
      });

      if (!retryable || attempt === maxAttempts) {
        return {
          ok: false,
          status: "failed",
          attempts: attempt,
          error: error.responseCode ? `smtp_${error.responseCode}` : (error.code || "smtp_send_failed"),
        };
      }

      await sleep(500 * 2 ** (attempt - 1));
    }
  }

  return { ok: false, status: "failed", attempts: maxAttempts, error: "smtp_send_failed" };
}

async function sendEmail(options) {
  const result = await sendEmailWithRetry(options);
  return result.ok;
}

module.exports = {
  sendEmail,
  sendEmailWithRetry,
  isSmtpConfigured,
  verifyTransporter,
  transporter,
  htmlToText,
  getMailboxAddress,
  isRetryableError,
  sleep,
};
