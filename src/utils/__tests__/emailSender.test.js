jest.mock("../../config/env", () => ({
  EMAIL_FROM: "orders@example.com",
  NEWSLETTER_FROM_NAME: "AA NEEDLES",
  NEWSLETTER_MAX_ATTEMPTS: 3,
}));

jest.mock("../../config/logger", () => ({
  warn: jest.fn(),
}));

jest.mock("../../utils/email", () => ({
  isSmtpConfigured: jest.fn(),
  transporter: {
    sendMail: jest.fn(),
  },
}));

const { isSmtpConfigured, transporter } = require("../../utils/email");
const { sendEmailWithRetry } = require("../emailSender");

describe("sendEmailWithRetry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not attempt delivery when SMTP is not configured", async () => {
    isSmtpConfigured.mockReturnValue(false);

    await expect(
      sendEmailWithRetry({ to: "customer@example.com", subject: "Order", html: "<p>Order</p>" })
    ).resolves.toMatchObject({ ok: false, attempts: 0 });
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  it("retries a temporary SMTP failure and reports successful delivery", async () => {
    isSmtpConfigured.mockReturnValue(true);
    transporter.sendMail
      .mockRejectedValueOnce(new Error("Temporary SMTP failure"))
      .mockResolvedValueOnce({ messageId: "accepted-message" });

    await expect(
      sendEmailWithRetry({
        to: "customer@example.com",
        subject: "Order",
        html: "<p>Order</p>",
        attempts: 2,
      })
    ).resolves.toMatchObject({ ok: true, attempts: 2 });
    expect(transporter.sendMail).toHaveBeenCalledTimes(2);
  });
});
