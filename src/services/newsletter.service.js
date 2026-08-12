const prisma = require("../config/db");
const env = require("../config/env");
const logger = require("../config/logger");
const AppError = require("../utils/AppError");
const { sendEmailWithRetry, sleep } = require("../utils/emailSender");
const { renderNewsletterTemplate } = require("../templates/newsletter.template");

const STATUS = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  SENDING: "SENDING",
  SENT: "SENT",
  FAILED: "FAILED",
};

const SEND = { SENT: "SENT", FAILED: "FAILED" };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isValidEmail = (email) =>
  typeof email === "string" && email.length <= 254 && EMAIL_REGEX.test(email);

// ---------------------------------------------------------------------------
// Admin campaign CRUD
// ---------------------------------------------------------------------------

async function createCampaign({ title, subject, content, ctaText, ctaUrl, scheduledAt }) {
  if (!title || !subject || !content) {
    throw new AppError("title, subject and content are required", 400);
  }
  return prisma.newsletter.create({
    data: {
      title,
      subject,
      content,
      ctaText: ctaText || null,
      ctaUrl: ctaUrl || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: STATUS.DRAFT,
    },
  });
}

async function updateCampaign(id, data) {
  const existing = await prisma.newsletter.findUnique({ where: { id } });
  if (!existing) throw new AppError("Newsletter not found", 404);
  if (existing.status !== STATUS.DRAFT) {
    throw new AppError("Only DRAFT newsletters can be edited", 400);
  }
  const { title, subject, content, ctaText, ctaUrl, scheduledAt } = data;
  return prisma.newsletter.update({
    where: { id },
    data: {
      title: title ?? existing.title,
      subject: subject ?? existing.subject,
      content: content ?? existing.content,
      ctaText: ctaText === undefined ? existing.ctaText : ctaText,
      ctaUrl: ctaUrl === undefined ? existing.ctaUrl : ctaUrl,
      scheduledAt: scheduledAt === undefined ? existing.scheduledAt : (scheduledAt ? new Date(scheduledAt) : null),
    },
  });
}

/** DRAFT -> PENDING (queue for the cron). */
async function scheduleCampaign(id, scheduledAt) {
  const existing = await prisma.newsletter.findUnique({ where: { id } });
  if (!existing) throw new AppError("Newsletter not found", 404);
  if (existing.status !== STATUS.DRAFT && existing.status !== STATUS.PENDING) {
    throw new AppError(`Cannot schedule a newsletter in ${existing.status} state`, 400);
  }
  return prisma.newsletter.update({
    where: { id },
    data: { status: STATUS.PENDING, scheduledAt: scheduledAt ? new Date(scheduledAt) : existing.scheduledAt },
  });
}

/** FAILED (or SENT partial) -> PENDING, keeping SENT rows as sent. */
async function retryFailedCampaign(id) {
  const existing = await prisma.newsletter.findUnique({ where: { id } });
  if (!existing) throw new AppError("Newsletter not found", 404);
  if (existing.status !== STATUS.FAILED && existing.status !== STATUS.SENT) {
    throw new AppError(`Cannot retry a newsletter in ${existing.status} state`, 400);
  }
  const [sent, failed] = await Promise.all([
    prisma.newsletterSend.count({ where: { newsletterId: id, status: SEND.SENT } }),
    prisma.newsletterSend.count({ where: { newsletterId: id, status: SEND.FAILED } }),
  ]);
  return prisma.newsletter.update({
    where: { id },
    data: {
      status: STATUS.PENDING,
      failureReason: null,
      sentAt: null,
      sentCount: sent,
      failedCount: failed,
    },
  });
}

async function listCampaigns({ page = 1, limit = 20, status }) {
  const where = status ? { status } : {};
  const [total, items] = await Promise.all([
    prisma.newsletter.count({ where }),
    prisma.newsletter.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getCampaign(id) {
  const campaign = await prisma.newsletter.findUnique({
    where: { id },
    include: {
      sends: { select: { status: true, error: true, sentAt: true } },
    },
  });
  if (!campaign) throw new AppError("Newsletter not found", 404);
  return campaign;
}

// ---------------------------------------------------------------------------
// Cron processing
// ---------------------------------------------------------------------------

/** Pending campaigns ready to send (immediate or scheduledAt passed). */
async function findPendingNewsletters() {
  return prisma.newsletter.findMany({
    where: {
      status: STATUS.PENDING,
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, subject: true, content: true, ctaText: true, ctaUrl: true },
  });
}

/**
 * Atomic claim: PENDING -> SENDING.
 * updateMany with a status guard means concurrent cron instances can never
 * claim the same newsletter twice (DB row lock).
 */
async function claimNewsletter(id) {
  const result = await prisma.newsletter.updateMany({
    where: { id, status: STATUS.PENDING },
    data: { status: STATUS.SENDING },
  });
  return result.count === 1;
}

async function getSubscriberCount(newsletterId) {
  const alreadySent = await prisma.newsletterSend.findMany({
    where: { newsletterId, status: SEND.SENT },
    select: { subscriberId: true },
  });
  const sentIds = new Set(alreadySent.map((r) => r.subscriberId));

  return prisma.newsletterSubscriber.count({
    where: {
      isActive: true,
      unsubscribedAt: null,
      id: { notIn: [...sentIds] },
    },
  });
}

/**
 * Cursor-paginated iteration over eligible subscribers.
 * Excludes: inactive, unsubscribed, and already-SENT for this campaign.
 * Yields batches of `batchSize` to the handler, with a delay between batches.
 */
async function forEachEligibleSubscriber(newsletterId, batchSize, onBatch) {
  const alreadySent = await prisma.newsletterSend.findMany({
    where: { newsletterId, status: SEND.SENT },
    select: { subscriberId: true },
  });
  const sentIds = new Set(alreadySent.map((r) => r.subscriberId));

  let cursor = null;
  let processed = 0;
  let total = await prisma.newsletterSubscriber.count({
    where: { isActive: true, unsubscribedAt: null },
  });

  while (true) {
    const page = await prisma.newsletterSubscriber.findMany({
      where: {
        isActive: true,
        unsubscribedAt: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, email: true, name: true, unsubscribeToken: true },
    });

    if (page.length === 0) break;

    const eligible = page.filter((s) => !sentIds.has(s.id));
    await onBatch(eligible, processed, total);

    processed += page.length;
    cursor = page[page.length - 1].id;

    if (page.length < batchSize) break;
  }

  return processed;
}

/**
 * Sends one campaign to all eligible subscribers.
 * Idempotent: subscriber SEND rows are upserted under a unique constraint,
 * so re-running never double-sends. A single email failure never aborts the
 * campaign — remaining subscribers are still processed.
 */
async function processNewsletter(newsletter, { dryRun = false } = {}) {
  const batchSize = env.NEWSLETTER_BATCH_SIZE;
  const batchDelay = env.NEWSLETTER_BATCH_DELAY;
  let sent = 0;
  let failed = 0;
  let invalid = 0;
  let batchIndex = 0;

  const track = (subscriberId, result, error) =>
    prisma.newsletterSend.upsert({
      where: {
        newsletterId_subscriberId: { newsletterId: newsletter.id, subscriberId },
      },
      update: result.ok
        ? { status: SEND.SENT, error: null, attempts: result.attempts, sentAt: new Date() }
        : { status: SEND.FAILED, error: error || result.error, attempts: result.attempts, sentAt: null },
      create: {
        newsletterId: newsletter.id,
        subscriberId,
        status: result.ok ? SEND.SENT : SEND.FAILED,
        error: error || result.error,
        attempts: result.attempts,
        sentAt: result.ok ? new Date() : null,
      },
    });

  await forEachEligibleSubscriber(newsletter.id, batchSize, async (subscribers, processed, total) => {
    batchIndex += 1;
    logger.info(`[newsletter] batch ${batchIndex} — ${subscribers.length} eligible (${processed}/${total} scanned)`);

    for (const subscriber of subscribers) {
      let token = subscriber.unsubscribeToken;
      if (!token) {
        token = `nl-${subscriber.id}-${Date.now().toString(36)}`;
        await prisma.newsletterSubscriber.update({
          where: { id: subscriber.id },
          data: { unsubscribeToken: token },
        });
      }

      if (!isValidEmail(subscriber.email)) {
        invalid += 1;
        failed += 1;
        await track(subscriber.id, { ok: false, attempts: 0 }, "Invalid email format");
        continue;
      }

      const html = renderNewsletterTemplate({
        newsletter,
        subscriber: { name: subscriber.name, unsubscribeToken: token },
        baseUrl: env.FRONTEND_URL,
        fromName: env.NEWSLETTER_FROM_NAME,
      });

      const result = dryRun
        ? { ok: true, attempts: 1 }
        : await sendEmailWithRetry({ to: subscriber.email, subject: newsletter.subject, html });

      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
      }

      if (!dryRun) {
        await track(subscriber.id, result);
      }
    }

    if (batchDelay > 0) await sleep(batchDelay);
  });

  return { sent, failed, invalid };
}

async function finalizeNewsletter(id, { sent, failed, failureReason }) {
  const status = failed > 0 && sent === 0 ? STATUS.FAILED : STATUS.SENT;
  let reason = failureReason;
  if (status === STATUS.FAILED && !reason) {
    const errors = await prisma.newsletterSend.findMany({
      where: { newsletterId: id, status: SEND.FAILED, error: { not: null } },
      select: { error: true },
      distinct: ["error"],
      take: 3,
    });
    reason = errors.length > 0
      ? errors.map((e) => e.error).join(" | ")
      : `All ${failed} recipient(s) failed to receive the newsletter`;
  }
  return prisma.newsletter.update({
    where: { id },
    data: {
      status,
      sentAt: new Date(),
      sentCount: sent,
      failedCount: failed,
      failureReason: status === STATUS.FAILED ? reason : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Public unsubscribe
// ---------------------------------------------------------------------------

async function unsubscribeByToken(token) {
  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!subscriber) return null;
  return prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { isActive: false, unsubscribedAt: new Date() },
  });
}

module.exports = {
  STATUS,
  SEND,
  createCampaign,
  updateCampaign,
  scheduleCampaign,
  retryFailedCampaign,
  listCampaigns,
  getCampaign,
  findPendingNewsletters,
  claimNewsletter,
  getSubscriberCount,
  processNewsletter,
  finalizeNewsletter,
  unsubscribeByToken,
  isValidEmail,
};
