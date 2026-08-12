const prisma = require("../config/db");
const env = require("../config/env");
const logger = require("../config/logger");
const newsletterService = require("../services/newsletter.service");

/**
 * Runs one newsletter dispatch cycle:
 * 1. Fetch pending newsletters (scheduledAt passed or null).
 * 2. Claim each one atomically (PENDING -> SENDING) so concurrent cron
 *    instances can never process the same campaign twice.
 * 3. Send in batches with delays; a failing email never aborts the campaign.
 * 4. Finalize status (SENT / FAILED) with counters.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.scheduled=false]
 * @param {boolean} [opts.dryRun=false] render + log only, no sends, no writes
 */
async function runNewsletterJob({ scheduled = false, dryRun = false } = {}) {
  const startedAt = Date.now();
  logger.info("[newsletter] job started", { scheduled, dryRun, executedAt: new Date().toISOString() });

  try {
    const pending = await newsletterService.findPendingNewsletters();
    logger.info(`[newsletter] found ${pending.length} pending newsletter(s)`, {
      newsletterIds: pending.map((n) => n.id),
    });

    const results = [];
    for (const newsletter of pending) {
      results.push(await dispatchNewsletter(newsletter, { dryRun }));
    }

    const summary = {
      newsletters: results.length,
      sent: results.reduce((sum, r) => sum + r.sent, 0),
      failed: results.reduce((sum, r) => sum + r.failed, 0),
    };

    logger.info("[newsletter] job completed", {
      ...summary,
      durationMs: Date.now() - startedAt,
      durationHuman: formatDuration(Date.now() - startedAt),
    });

    return { success: true, ...summary, results };
  } catch (error) {
    logger.error("[newsletter] job failed", { message: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
}

async function dispatchNewsletter(newsletter, { dryRun }) {
  const startedAt = Date.now();

  if (dryRun) {
    const total = await newsletterService.getSubscriberCount(newsletter.id);
    logger.info(`[newsletter] DRY RUN — newsletter "${newsletter.title}" would send to ~${total} subscriber(s)`);
    return { newsletterId: newsletter.id, title: newsletter.title, sent: 0, failed: 0, dryRun: true };
  }

  const claimed = await newsletterService.claimNewsletter(newsletter.id);
  if (!claimed) {
    logger.warn(`[newsletter] "${newsletter.title}" already claimed by another run — skipped`);
    return { newsletterId: newsletter.id, title: newsletter.title, skipped: true };
  }
  logger.info(`[newsletter] claimed newsletter "${newsletter.title}" (${newsletter.id})`);

  if (!newsletter.subject || !newsletter.content) {
    await finalize(newsletter.id, 0, 0, "Missing newsletter subject or content");
    return { newsletterId: newsletter.id, title: newsletter.title, sent: 0, failed: 0, missingContent: true };
  }

  let outcome;
  try {
    const subscriberCount = await newsletterService.getSubscriberCount(newsletter.id);
    logger.info(`[newsletter] subscribers to notify: ${subscriberCount}`);

    outcome = await newsletterService.processNewsletter(newsletter, { dryRun });
    logger.info(`[newsletter] "${newsletter.title}" dispatch finished`, {
      newsletterId: newsletter.id,
      ...outcome,
      durationMs: Date.now() - startedAt,
    });

    await finalize(newsletter.id, outcome.sent, outcome.failed, null);
  } catch (error) {
    logger.error(`[newsletter] dispatch failed for "${newsletter.title}"`, {
      newsletterId: newsletter.id,
      message: error.message,
      stack: error.stack,
    });
    await finalize(newsletter.id, 0, 0, error.message);
    return { newsletterId: newsletter.id, title: newsletter.title, sent: 0, failed: 0, error: error.message };
  }

  return { newsletterId: newsletter.id, title: newsletter.title, ...outcome };
}

async function finalize(newsletterId, sent, failed, failureReason) {
  const result = await newsletterService.finalizeNewsletter(newsletterId, { sent, failed, failureReason });
  const status = result.status === "SENT" ? "sent" : "failed";
  logger.info(`[newsletter] "${result.title}" finalized as ${status}`, {
    newsletterId,
    status: result.status,
    sent,
    failed,
    failureReason: result.failureReason || null,
  });
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remSeconds}s` : `${remSeconds}s`;
}

// Alias kept for compatibility with the previous stub implementation
const sendNewsletter = runNewsletterJob;

module.exports = { runNewsletterJob, sendNewsletter };
