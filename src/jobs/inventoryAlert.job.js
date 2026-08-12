const env = require("../config/env");
const logger = require("../config/logger");
const { scanInventory } = require("../services/inventoryAlert.service");
const { sendEmail, isSmtpConfigured } = require("../utils/email");
const { buildLowStockAlertHtml, buildLowStockAlertSubject } = require("../emails/inventoryAlert.email");

/**
 * Runs one full inventory-alert cycle.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.scheduled=false] true when invoked by the cron scheduler
 * @param {boolean} [opts.dryRun=false]   scan + log only; skip persistence and email
 */
async function runInventoryAlert({ scheduled = false, dryRun = false } = {}) {
  const startedAt = Date.now();
  const context = { scheduled, dryRun };

  logger.info("[inventory-alert] job started", {
    ...context,
    threshold: env.LOW_STOCK_THRESHOLD,
    executedAt: new Date(startedAt).toISOString(),
  });

  try {
    const report = await scanInventory({ dryRun });

    logger.info("[inventory-alert] scan completed", {
      scannedCount: report.scannedCount,
      totalActiveProducts: report.totalActiveProducts,
      lowStockCount: report.lowStockCount,
      outOfStockCount: report.outOfStockCount,
      dedupeSkippedCount: report.dedupeSkippedCount,
      notifiedCount: report.notifiedCount || 0,
      dryRun,
      durationMs: Date.now() - startedAt,
    });

    if (!dryRun && report.alertable.length > 0) {
      const recipients = env.ADMIN_EMAIL.split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (recipients.length === 0) {
        logger.warn("[inventory-alert] ADMIN_EMAIL is not configured — notification emails skipped");
      } else if (!isSmtpConfigured()) {
        logger.error("[inventory-alert] SMTP is not configured — notification emails NOT sent");
      } else {
        const subject = buildLowStockAlertSubject({
          lowStockCount: report.lowStockCount,
          outOfStockCount: report.outOfStockCount,
        });
        const html = buildLowStockAlertHtml({
          products: report.alertable,
          executedAt: report.executedAt,
          baseUrl: env.FRONTEND_URL,
        });

        const results = await Promise.allSettled(
          recipients.map((to) => sendEmail({ to, subject, html }))
        );

        const sent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
        const failed = results.length - sent;
        if (failed > 0) {
          logger.error("[inventory-alert] some notification emails failed to send", { sent, failed, recipients: recipients.length });
        } else {
          logger.info("[inventory-alert] notification emails sent", { sent, recipients: recipients.length });
        }
      }
    }

    if (dryRun && report.alertable.length > 0) {
      logger.info("[inventory-alert] DRY RUN — would notify", {
        sample: report.alertable.slice(0, 5).map((e) => ({
          name: e.product.name,
          sku: e.product.sku,
          stock: e.stock,
          threshold: e.threshold,
          severity: e.severity,
        })),
      });
    }

    logger.info("[inventory-alert] job finished", {
      success: true,
      durationMs: Date.now() - startedAt,
    });

    return report;
  } catch (error) {
    logger.error("[inventory-alert] job failed", {
      message: error.message,
      stack: error.stack,
      durationMs: Date.now() - startedAt,
    });
    return { success: false, error: error.message };
  }
}

// Alias kept for compatibility with the previous naive implementation
const checkLowStock = runInventoryAlert;

module.exports = { runInventoryAlert, checkLowStock };
