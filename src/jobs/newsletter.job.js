const { sendEmail } = require("../utils/email");
const logger = require("../config/logger");

const sendNewsletter = async () => {
  try {
    const subscribers = ["subscriber@example.com"];

    for (const email of subscribers) {
      await sendEmail({
        to: email,
        subject: "Neddles Newsletter",
        html: "<p>Check out our latest products!</p>",
      });
    }

    logger.info(`Newsletter sent to ${subscribers.length} subscribers`);
  } catch (error) {
    logger.error("Newsletter job failed:", error);
  }
};

module.exports = { sendNewsletter };
