/**
 * Manual runner for the newsletter dispatch job.
 * Usage:
 *   node scripts/run-newsletter-job.js           # full run (claims + sends)
 *   node scripts/run-newsletter-job.js --dry-run # render + log only, no sends/writes
 */
const prisma = require("../src/config/db");
const logger = require("../src/config/logger");
const { runNewsletterJob } = require("../src/jobs/newsletter.job");

const dryRun = process.argv.includes("--dry-run");

(async () => {
  logger.info(`[runner] starting newsletter job (dryRun=${dryRun})`);
  const result = await runNewsletterJob({ scheduled: false, dryRun });
  await prisma.$disconnect();
  if (result && result.success === false) {
    logger.error("[runner] newsletter job failed");
    process.exit(1);
  }
  logger.info("[runner] finished");
  process.exit(0);
})().catch(async (err) => {
  logger.error("[runner] unexpected error:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
