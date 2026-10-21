jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("../../config/env", () => ({
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: 587,
  SMTP_USER: "user",
  SMTP_PASS: "test-password",
  EMAIL_FROM: "orders@example.com",
  EMAIL_FROM_NAME: "AA NEEDLES",
  EMAIL_REPLY_TO: "support@example.com",
  EMAIL_RETURN_PATH: "",
  NEWSLETTER_MAX_ATTEMPTS: 3,
}));
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    verify: jest.fn(),
    sendMail: jest.fn(),
  })),
}));

const nodemailer = require("nodemailer");
const env = require("../../config/env");
const { isSmtpConfigured } = require("../email");
const transporter = nodemailer.createTransport.mock.results[0].value;
const { sendEmailWithRetry } = require("../emailSender");

describe("sendEmailWithRetry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.SMTP_PASS = "test-password";
  });

  it("does not attempt delivery when SMTP is not configured", async () => {
    env.SMTP_PASS = "";

    await expect(
      sendEmailWithRetry({ to: "customer@example.com", subject: "Order", html: "<p>Order</p>" })
    ).resolves.toMatchObject({ ok: false, attempts: 0, error: "smtp_not_configured" });
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  it("retries a transient SMTP failure and reports provider acceptance", async () => {
    const temporaryFailure = Object.assign(new Error("Temporary SMTP failure"), { responseCode: 450 });
    transporter.sendMail
      .mockRejectedValueOnce(temporaryFailure)
      .mockResolvedValueOnce({ messageId: "accepted-message" });

    await expect(
      sendEmailWithRetry({
        to: "customer@example.com",
        subject: "Order",
        html: "<p>Order</p>",
        attempts: 2,
      })
    ).resolves.toMatchObject({
      ok: true,
      status: "accepted",
      attempts: 2,
      messageId: "accepted-message",
    });
    expect(transporter.sendMail).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent SMTP rejection", async () => {
    const permanentFailure = Object.assign(new Error("Rejected"), { responseCode: 550 });
    transporter.sendMail.mockRejectedValueOnce(permanentFailure);

    await expect(
      sendEmailWithRetry({
        to: "customer@example.com",
        subject: "Order",
        html: "<p>Order</p>",
        attempts: 3,
      })
    ).resolves.toMatchObject({ ok: false, status: "failed", attempts: 1, error: "smtp_550" });
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
  });

  it("does not retry an ambiguous network timeout that could duplicate delivery", async () => {
    const timeout = Object.assign(new Error("Timed out"), { code: "ETIMEDOUT" });
    transporter.sendMail.mockRejectedValueOnce(timeout);

    await expect(
      sendEmailWithRetry({
        to: "customer@example.com",
        subject: "Order",
        html: "<p>Order</p>",
        attempts: 3,
      })
    ).resolves.toMatchObject({ ok: false, status: "failed", attempts: 1, error: "ETIMEDOUT" });
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
  });

  it("reports a resolved SMTP send with all recipients rejected as a failure", async () => {
    transporter.sendMail.mockResolvedValueOnce({
      accepted: [],
      rejected: ["customer@example.com"],
    });

    await expect(
      sendEmailWithRetry({
        to: "customer@example.com",
        subject: "Order",
        html: "<p>Order</p>",
        attempts: 3,
      })
    ).resolves.toMatchObject({
      ok: false,
      status: "failed",
      attempts: 1,
      error: "recipient_rejected",
    });
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
  });

  it("retries an explicit temporary recipient rejection", async () => {
    const temporaryFailure = Object.assign(new Error("Temporary rejection"), { responseCode: 451 });
    transporter.sendMail
      .mockResolvedValueOnce({
        accepted: [],
        rejected: ["customer@example.com"],
        rejectedErrors: [temporaryFailure],
      })
      .mockResolvedValueOnce({
        accepted: ["customer@example.com"],
        rejected: [],
        messageId: "accepted-message",
      });

    await expect(
      sendEmailWithRetry({
        to: "customer@example.com",
        subject: "Order",
        html: "<p>Order</p>",
        attempts: 2,
      })
    ).resolves.toMatchObject({ ok: true, status: "accepted", attempts: 2 });
    expect(transporter.sendMail).toHaveBeenCalledTimes(2);
  });

  it("sends a plain-text alternative and configured sender headers", async () => {
    transporter.sendMail.mockResolvedValueOnce({ messageId: "accepted-message" });

    await sendEmailWithRetry({
      to: "customer@example.com",
      subject: "Order",
      html: "<html><head><style>.x{}</style></head><body><p>Order <strong>received</strong></p></body></html>",
    });

    expect(transporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: '"AA NEEDLES" <orders@example.com>',
      replyTo: "support@example.com",
      text: "Order received",
    }));
  });
});
