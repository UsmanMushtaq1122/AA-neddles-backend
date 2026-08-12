# Newsletter Cron Job — QA Checklist & Operations Guide

Automated newsletter dispatch via cron. Sends PENDING campaigns to active
subscribers in batches, tracks every send per subscriber (idempotent), and
survives per-recipient failures without aborting the campaign.

## File Map

```
src/
├── jobs/
│   ├── newsletter.job.js        # dispatch cycle: claim -> batches -> finalize
│   └── index.js                 # cron registry (NEWSLETTER_CRON)
├── services/
│   └── newsletter.service.js    # campaign lifecycle, claim lock, batching, tracking, retry
├── templates/
│   └── newsletter.template.js   # responsive HTML, greeting, CTA, unsubscribe link
├── utils/
│   ├── email.js                 # shared nodemailer transporter (exported)
│   └── emailSender.js           # sendEmailWithRetry (backoff, returns {ok, attempts, error})
├── controllers/newsletter.controller.js  # campaign admin API + public unsubscribe
├── routes/newsletter.routes.js
├── config/env.js                # NEWSLETTER_* vars
└── scripts/run-newsletter-job.js
```

## Workflow

```
DRAFT ──schedule──▶ PENDING ──claim (atomic)──▶ SENDING ──finalize──▶ SENT
                       │                                              │
                       └───────────────────────────── failureReason ──▶ FAILED
FAILED / SENT ──retry──▶ PENDING (SENT rows are kept; only FAILED re-attempted)
```

## Concurrency & Idempotency

- **Processing lock:** `claimNewsletter()` runs `updateMany` with
  `WHERE id = ? AND status = 'PENDING'`. Only one process can win the
  transition to `SENDING` — concurrent cron instances (or a manual run
  overlapping the scheduler) can never process the same campaign twice.
- **Sent tracking:** `NewsletterSend` rows with `@@unique([newsletterId, subscriberId])`.
- **Idempotent execution:** already-`SENT` subscribers are excluded from every
  run; re-running a campaign never double-sends to anyone.
- **Cross-instance guidance:** in multi-instance deployments, keep
  `ENABLE_CRON_JOBS=true` on exactly one instance (or add a Redis/distributed
  lock on top of the DB claim).

## Batching & Rate Limiting

- `NEWSLETTER_BATCH_SIZE` (default 50) subscribers per query batch.
- `NEWSLETTER_BATCH_DELAY` (default 3000 ms) pause between batches.
- `NEWSLETTER_MAX_ATTEMPTS` (default 3) per recipient with exponential backoff
  (500 ms → 1 s).
- Subscribers are fetched with cursor pagination (`id` asc, `take = batchSize`)
  — 10k+ lists never load into memory.
- Eligible-list exclusion (`isActive = true`, `unsubscribedAt = null`, not
  already SENT) is resolved in one indexed query per campaign.

## Error Handling

| Failure | Behavior |
|---|---|
| SMTP down / timeout | `sendEmailWithRetry` retries ×3 with backoff; then FAILED recorded, job continues to next subscriber |
| One recipient fails | Only that recipient is marked FAILED; remaining batches continue |
| Database error mid-campaign | Campaign finalized as FAILED with reason; next cron run (after admin retry) resumes |
| Invalid email format | Skipped without sending, recorded FAILED "Invalid email format" |
| Missing subject/content | Claimed campaign finalized FAILED "Missing newsletter subject or content" |
| Missing unsubscribe token | Token generated lazily before the email is rendered |
| Concurrent claim | Loser skips with warning; no double send |

Counters (`sentCount`, `failedCount`) are written once at finalize time;
live per-campaign status is queryable via `NewsletterSend`.

## Admin API (all under `/api/v1/newsletter`, auth + admin role)

| Method | Route | Purpose |
|---|---|---|
| POST | `/campaigns` | Create (DRAFT) — `{ title, subject, content, ctaText?, ctaUrl?, scheduledAt? }` |
| GET | `/campaigns?page=&limit=&status=` | List with delivery stats |
| GET | `/campaigns/:id` | Detail incl. all sends (SENT/FAILED + error) |
| PUT | `/campaigns/:id` | Edit (DRAFT only) |
| PATCH | `/campaigns/:id/schedule` | Queue: DRAFT/PENDING → PENDING (+ optional `scheduledAt`) |
| POST | `/campaigns/:id/retry` | FAILED/SENT → PENDING (recounts; re-attempts only failures) |
| GET | `/unsubscribe?token=` | Public — disables subscriber, returns confirmation page |

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `NEWSLETTER_CRON` | `0 10 * * *` | Schedule (daily 10:00) |
| `NEWSLETTER_BATCH_SIZE` | `50` | Subscribers per batch |
| `NEWSLETTER_BATCH_DELAY` | `3000` | ms pause between batches (2–5 s advised) |
| `NEWSLETTER_MAX_ATTEMPTS` | `3` | Send attempts per recipient |
| `NEWSLETTER_FROM_NAME` | `AA NEEDLES` | From display name |
| `CRON_TIMEZONE` | `Asia/Karachi` | Schedule timezone |
| `ENABLE_CRON_JOBS` | `true` | Master switch (false on non-scheduler instances) |

## Manual Runs

```bash
npm run job:newsletter          # full dispatch of all pending campaigns
npm run job:newsletter:dry      # simulate — logs what would send, writes nothing
```

## QA Checklist

| # | Scenario | How to verify |
|---|---|---|
| 1 | Newsletter created successfully | `POST /campaigns` → 201, status `DRAFT` |
| 2 | Pending newsletters processed | `PATCH /campaigns/:id/schedule` (no date) → status `PENDING`; `npm run job:newsletter` → claimed + processed |
| 3 | Emails sent successfully | With real SMTP: `NewsletterSend` rows `SENT`, `sentCount` matches, email received with greeting/CTA/branding |
| 4 | Failed emails logged | Set SMTP to a bad host → rows `FAILED` with error, `failedCount` incremented, error in `logs/error.log` |
| 5 | Duplicate sends prevented | Run job twice → second run claims nothing (SENT), `NewsletterSend` still one row per subscriber |
| 6 | Batch processing works | `NEWSLETTER_BATCH_SIZE=2` with 5 subscribers → progress logs show batch 1..3, delay between batches |
| 7 | Unsubscribe respected | `GET /unsubscribe?token=<token>` → subscriber `isActive=false` + `unsubscribedAt`; next run excludes them |
| 8 | Status updates correctly | DRAFT→PENDING→SENDING→SENT (or FAILED with `failureReason`) transitions visible via API |
| 9 | Cron executes on schedule | `NEWSLETTER_CRON=*/1 * * * *` + boot server → `[cron] newsletter dispatch scheduled` + job runs every minute |
| 10 | Large subscriber lists handled | 10k+ subscribers: cursor paging logs advance monotonically, memory stays flat, job completes with totals |
| 11 | Concurrent execution prevented | Two runners simultaneously → exactly one claims (`skipped: true` for the loser) |
| 12 | Retry works | After FAILED campaign, `POST /campaigns/:id/retry` → PENDING; only FAILED recipients re-attempted |
| 13 | Partial failure continues | One invalid email among many → invalid one FAILED, all others SENT, campaign finalizes SENT |
| 14 | Personalized greeting | Subscriber with `name` gets "Hello Name,"; without name gets "Hello," |
| 15 | Invalid token rejected | `/unsubscribe?token=bogus` → 400 |

## Deployment Notes

1. `npx prisma migrate deploy` (adds `Newsletter`, `NewsletterSend`, subscriber token columns).
2. Set `NEWSLETTER_CRON`/`NEWSLETTER_BATCH_*` in env; real SMTP required for delivery.
3. Run the scheduler on one instance only (`ENABLE_CRON_JOBS`).
4. Monitor `logs/combined.log` for `[newsletter] job completed` summaries
   (newsletters / sent / failed / duration) and `logs/error.log` for `[newsletter] job failed`.
5. Security: unsubscribe tokens are unique and single-use (subscribing again re-activates);
   all recipient fields are HTML-escaped in templates; campaign routes are admin-only.
