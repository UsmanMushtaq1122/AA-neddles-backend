/**
 * Manual runner for the low-stock inventory alert job.
 * Usage:
 *   node scripts/run-inventory-alert.js          # full run (persists + emails)
 *   node scripts/run-inventory-alert.js --dry-run # scan + log only
 */
const prisma = require("../src/config/db");
const logger = require("../src/config/logger");
const { runInventoryAlert } = require("../src/jobs/inventoryAlert.job");

const dryRun = process.argv.includes("--dry-run");

(async () => {
  logger.info(`[runner] starting inventory alert (dryRun=${dryRun})`);
  const result = await runInventoryAlert({ scheduled: false, dryRun });
  await prisma.$disconnect();
  if (result && result.success === false) {
    logger.error("[runner] job failed");
    process.exit(1);
  }
  logger.info("[runner] finished");
  process.exit(0);
})().catch(async (err) => {
  logger.error("[runner] unexpected error:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
