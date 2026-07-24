const prisma = require("../config/db");
const { sendEmail } = require("../utils/email");
const logger = require("../config/logger");

const checkPendingOrders = async () => {
  try {
    const pendingOrders = await prisma.order.findMany({
      where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      include: { customer: true },
    });

    for (const order of pendingOrders) {
      await sendEmail({
        to: order.customer.email,
        subject: "Order Reminder",
        html: `<p>Hi ${order.customer.name}, your order #${order.id} is still pending.</p>`,
      });
    }

    logger.info(`Sent reminders for ${pendingOrders.length} pending orders`);
  } catch (error) {
    logger.error("Order reminder job failed:", error);
  }
};

module.exports = { checkPendingOrders };
