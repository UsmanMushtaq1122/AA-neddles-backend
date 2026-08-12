const crypto = require("crypto");
const { sendEmail } = require("../utils/email");

const OTP_LENGTH = 4;
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

/**
 * Generate a cryptographically secure 4-digit OTP.
 */
function generateOtp() {
  // Use crypto to generate a random number in range [0, 9999]
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0) % 10000;
  // Zero-pad to 4 digits
  return String(num).padStart(4, "0");
}

/**
 * Hash an OTP using SHA-256 so it is never stored in plain text.
 */
function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Check if the OTP resend cooldown has elapsed.
 * @param {Date|null} lastOtpSentAt
 * @returns {number} seconds remaining (0 means ready to resend)
 */
function getResendCooldownRemaining(lastOtpSentAt) {
  if (!lastOtpSentAt) return 0;
  const elapsed = (Date.now() - new Date(lastOtpSentAt).getTime()) / 1000;
  const remaining = OTP_RESEND_COOLDOWN_SECONDS - elapsed;
  return remaining > 0 ? Math.ceil(remaining) : 0;
}

/**
 * Send OTP email for email verification (registration flow).
 */
async function sendRegistrationOtpEmail(email, name, otp) {
  return sendEmail({
    to: email,
    subject: "Your AA Neddles Verification Code",
    html: buildOtpEmailHtml({
      title: "Verify Your Email",
      greeting: `Welcome to AA Neddles, ${name}!`,
      bodyText: `Thank you for registering. Use the code below to verify your email address. This code expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.`,
      otp,
      footerNote: "If you did not create an account, you can safely ignore this email.",
    }),
  });
}

/**
 * Send OTP email for forgot-password flow.
 */
async function sendPasswordResetOtpEmail(email, name, otp) {
  return sendEmail({
    to: email,
    subject: "AA Neddles — Password Reset Code",
    html: buildOtpEmailHtml({
      title: "Reset Your Password",
      greeting: `Hello, ${name}!`,
      bodyText: `You requested a password reset. Enter the code below to reset your password. This code expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.`,
      otp,
      footerNote: "If you did not request a password reset, please ignore this email and your password will remain unchanged.",
    }),
  });
}

/**
 * Build a beautiful HTML OTP email template.
 */
function buildOtpEmailHtml({ title, greeting, bodyText, otp, footerNote }) {
  const digits = otp.split("").map(
    (d) =>
      `<span style="display:inline-block;width:44px;height:56px;line-height:56px;font-size:28px;font-weight:700;font-family:monospace;color:#1A1A1A;background:#F5F0EB;border:1px solid #C9A96E;border-radius:6px;margin:0 4px;text-align:center;">${d}</span>`
  ).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
          <!-- Header -->
          <tr>
            <td style="background:#1A1A1A;padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#C9A96E;font-size:22px;font-weight:300;letter-spacing:3px;text-transform:uppercase;">AA NEDDLES</h1>
              <p style="margin:4px 0 0;color:#ffffff70;font-size:12px;letter-spacing:1px;">Luxury Fashion &amp; Premium Clothing</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 20px;">
              <h2 style="margin:0 0 12px;color:#1A1A1A;font-size:22px;font-weight:400;">${title}</h2>
              <p style="margin:0 0 8px;color:#1A1A1A;font-size:16px;font-weight:600;">${greeting}</p>
              <p style="margin:0 0 30px;color:#666;font-size:14px;line-height:1.7;">${bodyText}</p>

              <!-- OTP Box -->
              <div style="text-align:center;padding:28px 20px;background:#FAFAFA;border:1px solid #E8E0D5;border-radius:8px;margin-bottom:28px;">
                <p style="margin:0 0 16px;color:#999;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Your Verification Code</p>
                <div style="letter-spacing:2px;">${digits}</div>
                <p style="margin:16px 0 0;color:#999;font-size:12px;">Valid for ${OTP_EXPIRY_MINUTES} minutes only</p>
              </div>

              <div style="background:#FFF8E7;border-left:3px solid #C9A96E;padding:12px 16px;border-radius:0 4px 4px 0;margin-bottom:20px;">
                <p style="margin:0;color:#7A6543;font-size:13px;">
                  🔒 <strong>Security Notice:</strong> Never share this code with anyone. AA Neddles will never ask you for this code.
                </p>
              </div>

              <p style="color:#999;font-size:12px;line-height:1.6;">${footerNote}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 30px;border-top:1px solid #F0EBE3;">
              <p style="margin:0;color:#bbb;font-size:11px;text-align:center;">
                &copy; ${new Date().getFullYear()} AA Neddles. All rights reserved.<br/>
                If you have questions, contact our support team.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Validate an OTP against a user record.
 * Returns { valid: true } or throws an AppError.
 */
function validateOtpAttempt(user, otp) {
  const AppError = require("../utils/AppError");

  if (!user.otp || !user.otpExpiresAt) {
    throw new AppError("No OTP found. Please request a new one.", 400);
  }

  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(
      "Too many incorrect attempts. Please request a new OTP.",
      429
    );
  }

  if (new Date() > new Date(user.otpExpiresAt)) {
    throw new AppError("OTP has expired. Please request a new one.", 400);
  }

  const hashedInput = hashOtp(otp);
  if (hashedInput !== user.otp) {
    return { valid: false, attemptsLeft: OTP_MAX_ATTEMPTS - (user.otpAttempts + 1) };
  }

  return { valid: true };
}

module.exports = {
  generateOtp,
  hashOtp,
  getResendCooldownRemaining,
  sendRegistrationOtpEmail,
  sendPasswordResetOtpEmail,
  validateOtpAttempt,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
};
