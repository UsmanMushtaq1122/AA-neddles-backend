const prisma = require("../config/db");
const AppError = require("../utils/AppError");

const NOTIFICATION_TYPES = {
  LOW_STOCK: "LOW_STOCK",
  ORDER: "ORDER",
  SYSTEM: "SYSTEM",
};

const SEVERITIES = {
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
  INFO: "INFO",
};

/**
 * Bulk-create notifications (low-stock digests).
 * @param {Array<{type: string, severity: string, title: string, message?: string, data?: object, productId?: string}>} entries
 * @returns {Promise<number>} number of rows created
 */
async function createMany(entries) {
  if (!entries || entries.length === 0) return 0;
  const result = await prisma.notification.createMany({
    data: entries.map((e) => ({
      type: e.type,
      severity: e.severity,
      title: e.title,
      message: e.message || null,
      data: e.data || undefined,
      productId: e.productId || null,
    })),
  });
  return result.count;
}

/**
 * Product IDs that already received a LOW_STOCK notification within `since`.
 * Used to prevent duplicate alerts within the dedupe window (24h).
 * @returns {Promise<Set<string>>}
 */
async function findRecentLowStockProductIds(since) {
  const rows = await prisma.notification.findMany({
    where: {
      type: NOTIFICATION_TYPES.LOW_STOCK,
      productId: { not: null },
      createdAt: { gte: since },
    },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}

/**
 * Paginated listing for the admin dashboard.
 */
async function list({ page = 1, limit = 20, type, isRead }) {
  const where = {};
  if (type) where.type = type;
  if (typeof isRead === "boolean") where.isRead = isRead;

  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function markRead(id) {
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) throw new AppError("Notification not found", 404);
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

async function markAllRead() {
  const result = await prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

async function unreadCount() {
  return prisma.notification.count({ where: { isRead: false } });
}

module.exports = {
  NOTIFICATION_TYPES,
  SEVERITIES,
  createMany,
  findRecentLowStockProductIds,
  list,
  markRead,
  markAllRead,
  unreadCount,
};
