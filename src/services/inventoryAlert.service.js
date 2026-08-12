const prisma = require("../config/db");
const env = require("../config/env");
const logger = require("../config/logger");
const notificationService = require("./notification.service");

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const SEVERITY_CRITICAL = notificationService.SEVERITIES.CRITICAL;
const SEVERITY_WARNING = notificationService.SEVERITIES.WARNING;

function classifySeverity(stock) {
  if (stock <= 0) return SEVERITY_CRITICAL;
  return SEVERITY_WARNING;
}

function effectiveThreshold(product) {
  if (Number.isFinite(product.lowStockThreshold) && product.lowStockThreshold > 0) {
    return product.lowStockThreshold;
  }
  return env.LOW_STOCK_THRESHOLD;
}

/**
 * Scans all ACTIVE products in batches (cursor pagination on id) and returns
 * products that need an alert. Never loads the full catalog into memory.
 */
async function scanActiveProducts({ onBatch }) {
  const batchSize = env.INVENTORY_SCAN_BATCH_SIZE;
  const where = { status: "ACTIVE" };
  const select = {
    id: true,
    name: true,
    slug: true,
    sku: true,
    stock: true,
    lowStockThreshold: true,
    category: { select: { name: true } },
  };

  const total = await prisma.product.count({ where });

  const scanned = [];
  let cursor = null;
  let scannedCount = 0;

  while (scannedCount < total) {
    const page = await prisma.product.findMany({
      where: cursor ? { ...where, id: { gt: cursor } } : where,
      select,
      orderBy: { id: "asc" },
      take: batchSize,
    });

    if (page.length === 0) break;
    scanned.push(...page);
    scannedCount += page.length;
    cursor = page[page.length - 1].id;

    if (typeof onBatch === "function") onBatch(page.length, scannedCount, total);
  }

  return { products: scanned, total };
}

/**
 * Main inventory scan.
 * - classifies severity (CRITICAL = 0 stock, WARNING = <= threshold)
 * - skips products already alerted within the last 24h (dedupe)
 * - persists notifications via bulk createMany
 *
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false] log findings but do not persist/send
 */
async function scanInventory({ dryRun = false } = {}) {
  const startedAt = new Date();
  const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_MS);

  const recentIds = await notificationService.findRecentLowStockProductIds(dedupeSince);
  const alreadyAlerted = new Set(recentIds);

  const { products, total } = await scanActiveProducts({
    onBatch: (batchLen, cumulative, grandTotal) =>
      logger.debug(`[inventory-alert] scanned ${cumulative}/${grandTotal} active products`),
  });

  const lowStock = [];
  const outOfStock = [];
  let dedupeSkippedCount = 0;

  for (const product of products) {
    const threshold = effectiveThreshold(product);
    const stock = Number.isFinite(product.stock) ? product.stock : 0;
    const severity = classifySeverity(stock);

    if (stock > threshold) continue;

    if (alreadyAlerted.has(product.id)) {
      dedupeSkippedCount += 1;
      continue;
    }

    const entry = {
      product,
      severity,
      threshold,
      stock,
      categoryName: product.category?.name || "Uncategorized",
    };
    lowStock.push(entry);
    if (stock <= 0) outOfStock.push(entry);
  }

  const report = {
    success: true,
    dryRun,
    executedAt: startedAt.toISOString(),
    scannedCount: products.length,
    totalActiveProducts: total,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    dedupeSkippedCount,
    alreadyAlertedCount: alreadyAlerted.size,
    alertable: lowStock,
  };

  if (dryRun || lowStock.length === 0) return report;

  const entries = lowStock.map(({ product, severity, threshold, stock, categoryName }) => ({
    type: notificationService.NOTIFICATION_TYPES.LOW_STOCK,
    severity,
    title:
      severity === SEVERITY_CRITICAL
        ? `Out of stock: ${product.name}`
        : `Low stock: ${product.name}`,
    message: `${categoryName} — ${stock} left (threshold ${threshold})`,
    productId: product.id,
    data: {
      sku: product.sku,
      stock,
      threshold,
      category: categoryName,
      productSlug: product.slug,
    },
  }));

  let notifiedCount = 0;
  for (let i = 0; i < entries.length; i += 1000) {
    notifiedCount += await notificationService.createMany(entries.slice(i, i + 1000));
  }

  report.notifiedCount = notifiedCount;
  return report;
}

module.exports = {
  scanInventory,
  scanActiveProducts,
  classifySeverity,
  effectiveThreshold,
  DEDUPE_WINDOW_MS,
};
