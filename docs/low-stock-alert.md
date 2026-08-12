# Low Stock Alert — Production Design & Operations Guide

Automated inventory monitoring that notifies admins when products drop below their
stock threshold. Runs daily at 9:00 AM (configurable), batched to handle 10,000+ products.

## Folder Structure

```
backend/
├── prisma/
│   ├── schema.prisma                  # Notification model + enums added
│   └── migrations/20260807090000_add_notifications/
├── src/
│   ├── config/
│   │   ├── env.js                     # LOW_STOCK_* vars, CRON_TIMEZONE
│   │   └── logger.js                  # winston (console + logs/combined.log + error.log)
│   ├── jobs/
│   │   ├── index.js                   # node-cron registry (start/stop/validate)
│   │   └── inventoryAlert.job.js      # orchestration, email digest, full logging
│   ├── services/
│   │   ├── inventoryAlert.service.js  # batched scanner, severity, 24h dedupe
│   │   └── notification.service.js    # Notification persistence + admin queries
│   ├── emails/
│   │   └── inventoryAlert.email.js    # HTML digest template (escaping, badges, links)
│   ├── controllers/notification.controller.js
│   ├── routes/notification.routes.js  # admin API (list / unread-count / mark-read)
│   ├── utils/email.js                 # + isSmtpConfigured(), sendEmail returns bool
│   └── server.js                      # startJobs() after DB connect; stopJobs() on shutdown
├── scripts/
│   └── run-inventory-alert.js         # manual trigger (--dry-run supported)
└── logs/                              # winston output
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `LOW_STOCK_THRESHOLD` | `10` | Global fallback threshold (used when a product's own `lowStockThreshold` is 0) |
| `LOW_STOCK_CRON` | `0 9 * * *` | node-cron expression (5/6 fields) |
| `CRON_TIMEZONE` | `Asia/Karachi` | Timezone for the schedule |
| `ADMIN_EMAIL` | `""` | Comma-separated admin recipients of the digest email |
| `ENABLE_CRON_JOBS` | `true` | `false` disables all schedulers (single-instance runs) |
| `INVENTORY_SCAN_BATCH_SIZE` | `500` | Products per query batch |

**Threshold precedence:** per-product `Product.lowStockThreshold` (when > 0) →
`LOW_STOCK_THRESHOLD`. Per-product thresholds can be edited in the admin panel.

## Severity Classification

| Condition | Severity |
|---|---|
| `stock <= 0` | `CRITICAL` — "Out of stock" |
| `0 < stock <= threshold` | `WARNING` — "Low stock" |
| `stock > threshold` | `HEALTHY` — no alert |

## Deduplication

- Before scanning, one query fetches all `LOW_STOCK` notifications from the last
  **24 hours** and builds a `Set` of `productId`s.
- Products in that set are skipped — each product alerts at most once per 24h,
  regardless of how often the cron runs.
- The dedupe window is `DEDUPE_WINDOW_MS` in `inventoryAlert.service.js`.

## Performance & Scalability (10k+ products)

- **Cursor pagination** (`orderBy: id`, `take: 500`) — never loads the catalog into memory.
- **Projected queries** — `select` only `id/name/slug/sku/stock/lowStockThreshold` + category name via a single join (`include` on select). No N+1.
- **One dedupe query** per run (indexed: `@@index([type, productId, createdAt])`).
- **Bulk inserts** — notifications written with `createMany` in 1,000-row chunks.
- **Single digest email** listing all findings (not one email per product).
- All hot columns (`status`, `id`, `createdAt`) are already indexed in the schema.

## Error Handling Strategy

| Failure | Behavior |
|---|---|
| DB connection failure | `scanInventory` throws → job catches, logs stack, returns `{ success: false }`; cron continues next day |
| Missing/invalid stock value | Schema is `Int` non-null; code defensively coerces via `Number.isFinite` fallback to 0 |
| Email service failure | `sendEmail` returns `false` → `Promise.allSettled` counts failures → `logger.error` with sent/failed counts |
| SMTP not configured | Detected via `isSmtpConfigured()` → explicit `logger.error`, no silent swallow |
| `ADMIN_EMAIL` missing | Warned, notifications still persisted to DB |
| Invalid cron expression | `cron.validate` at boot → `logger.error`, job not scheduled |
| Unexpected exception | Top-level try/catch in job → logged with stack + duration |

Notifications are always persisted to the database **before** email is attempted,
so a mail outage never loses alert data.

## Admin Dashboard API

All routes require `Authorization: Bearer <admin token>` (`ADMIN`/`SUPER_ADMIN`):

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/notifications?page=&limit=&type=&isRead=` | Paginated listing (newest first) |
| GET | `/api/v1/notifications/unread-count` | Badge count |
| PATCH | `/api/v1/notifications/:id/read` | Mark single |
| PATCH | `/api/v1/notifications/read-all` | Mark all |

Notification shape: `{ id, type: "LOW_STOCK", severity: "WARNING"|"CRITICAL", title, message, data: { sku, stock, threshold, category, productSlug }, productId, isRead, createdAt }`

## Operations

```bash
# Manual full run (persists notifications + sends email)
npm run job:low-stock

# Manual dry run (scan + log only — safe, no writes)
npm run job:low-stock:dry
```

Logs: console (dev) + `logs/combined.log` / `logs/error.log` (winston).
Each run logs: start, batches scanned, counts (low/out-of-stock/dedupe-skipped),
emails sent, execution time, and any errors.

## Deployment Guide

1. **Apply schema:** `npx prisma migrate deploy` (creates `Notification` table + enums).
2. **Env:** set `LOW_STOCK_CRON`, `LOW_STOCK_THRESHOLD`, `ADMIN_EMAIL`, `CRON_TIMEZONE` in the environment (`.env` in dev, secret manager in prod).
3. **Multi-instance deployments:** run the cron on **exactly one instance** (`ENABLE_CRON_JOBS=false` on the others). For N-instance HA, wrap execution in a distributed lock (Redis `SET NX EX`, advisory lock via `pg_advisory_lock`) or use a dedicated scheduler container.
4. **Observability:** alert on the `[inventory-alert] job failed` error log; wire `logs/` to your log aggregator (Datadog/Loki/CloudWatch).
5. **Email:** configure real SMTP (`SMTP_HOST/PORT/USER/PASS/EMAIL_FROM`); use a transactional provider (SendGrid/Postmark) in prod for deliverability.

## Security Recommendations

- Emails HTML-escape all product fields (`escapeHtml`) — prevents template injection via product names/SKUs.
- Admin notification routes are behind `authMiddleware` + `adminMiddleware`.
- Keep `JWT_SECRET`/SMTP credentials out of git (use a secret manager in prod).
- Rotate SMTP app-passwords; restrict `ADMIN_EMAIL` to trusted ops addresses.
- The job itself runs unauthenticated internally but only performs read queries + notification writes.

## QA Checklist

| # | Scenario | Verification |
|---|---|---|
| 1 | Low stock triggers alert | Product with `stock <= threshold` (e.g. 5/10) appears in dry-run output + DB `Notification` row with `severity=WARNING` |
| 2 | Out of stock triggers critical | Product with `stock = 0` produces `severity=CRITICAL`, title "Out of stock: …" |
| 3 | Healthy products skipped | `stock > threshold` products never create notifications |
| 4 | Inactive products skipped | `DRAFT`/`ARCHIVED` products excluded (filter is `status: "ACTIVE"`) |
| 5 | Duplicate alerts prevented | Run `npm run job:low-stock` twice within 24h → second run logs `dedupeSkippedCount > 0` and creates no new rows for the same product |
| 6 | Cron executes on schedule | Boot server with `LOW_STOCK_CRON=*/1 * * * *` → `[cron] low-stock alert scheduled` + job runs every minute |
| 7 | Notifications stored in DB | `GET /api/v1/notifications` (admin token) returns rows with type/severity/data |
| 8 | Emails sent successfully | With real SMTP + `ADMIN_EMAIL` → digest received, log line `notification emails sent` |
| 9 | Email failure handled | Invalid SMTP → `logger.error` "notification emails NOT sent", exit code 0, no crash |
| 10 | Logs generated correctly | `logs/combined.log` contains start/scan/complete lines with counts + `durationMs`; failures in `logs/error.log` |
| 11 | DB failure handled | Stop PostgreSQL → run job → `[inventory-alert] job failed` logged, process exits non-zero from runner |
| 12 | Batch paging correct | Set `INVENTORY_SCAN_BATCH_SIZE=2` with 5+ products → `scannedCount` equals total active products |
| 13 | Threshold override | Product with `lowStockThreshold=0` falls back to `LOW_STOCK_THRESHOLD`; product with `lowStockThreshold=50` alerts earlier |
| 14 | Admin API auth | Request without token → 401; customer-role token → 403 |
