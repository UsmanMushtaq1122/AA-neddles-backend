const cron = require("node-cron");
const env = require("../config/env");
const logger = require("../config/logger");
const { runInventoryAlert } = require("./inventoryAlert.job");
const { runNewsletterJob } = require("./newsletter.job");
const { checkPendingOrders } = require("./orderReminder.job");

const scheduledJobs = [];

function scheduleCron(expression, task, label) {
  if (!cron.validate(expression)) {
    logger.error(`[cron] invalid cron expression "${expression}" — ${label} NOT scheduled`);
    return;
  }
  const timezone = process.env.CRON_TIMEZONE || "Asia/Karachi";
  scheduledJobs.push(cron.schedule(expression, task, { timezone }));
  logger.info(`[cron] ${label} scheduled: "${expression}" (${timezone})`);
}

function startJobs() {
  if (!env.ENABLE_CRON_JOBS) {
    logger.warn("[cron] scheduled jobs disabled (ENABLE_CRON_JOBS=false)");
    return scheduledJobs;
  }

  scheduleCron(env.LOW_STOCK_CRON, () => runInventoryAlert({ scheduled: true }), "low-stock alert");
  scheduleCron(env.NEWSLETTER_CRON, () => runNewsletterJob({ scheduled: true }), "newsletter dispatch");
  scheduleCron(env.ORDER_REMINDER_CRON, () => checkPendingOrders(), "order reminder");

  return scheduledJobs;
}

function stopJobs() {
  scheduledJobs.forEach((job) => job.stop());
  scheduledJobs.length = 0;
  logger.info("[cron] scheduled jobs stopped");
}

module.exports = { startJobs, stopJobs };
