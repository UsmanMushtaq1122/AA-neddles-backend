const prisma = require("../config/db");

const DEFAULT_CATEGORIES = ["ORDERS", "SHIPPING", "RETURNS", "PAYMENTS", "ACCOUNT", "PRODUCTS"];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function findCategoryByInsensitiveName(name) {
  return prisma.fAQCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
}

async function createCategory(name, { isDefault = false, sortOrder = 0 }) {
  const slug = await uniqueSlug(slugify(name));
  return prisma.fAQCategory.create({ data: { name, slug, isDefault, sortOrder } });
}

async function uniqueSlug(baseSlug) {
  if (!baseSlug) baseSlug = "category";
  const existing = await prisma.fAQCategory.findUnique({ where: { slug: baseSlug } });
  if (!existing) return baseSlug;
  let i = 1;
  while (await prisma.fAQCategory.findUnique({ where: { slug: `${baseSlug}-${i}` } })) i += 1;
  return `${baseSlug}-${i}`;
}

/**
 * Ensures the six default categories exist, backfills custom categories
 * used by existing FAQs, and normalizes FAQ records onto canonical names.
 * Safe to call on every server start.
 */
async function ensureDefaultFaqCategories() {
  const faqs = await prisma.fAQ.findMany({ select: { category: true } });
  const usedCategories = [...new Set(faqs.map((f) => f.category).filter(Boolean))];

  let customSort = DEFAULT_CATEGORIES.length;

  // 1. Ensure all default categories exist (recreate any missing ones).
  for (const [index, name] of DEFAULT_CATEGORIES.entries()) {
    const existing = await findCategoryByInsensitiveName(name);
    if (existing) {
      const slug = slugify(name);
      await prisma.fAQCategory.update({
        where: { id: existing.id },
        data: { isDefault: true, sortOrder: index, ...(existing.slug !== slug ? { slug } : {}) },
      });
    } else {
      await prisma.fAQCategory.create({
        data: { name, slug: slugify(name), isDefault: true, sortOrder: index, isActive: true },
      });
    }
  }

  // 2. Backfill categories that existing FAQs reference but are not in the table,
  //    so they remain manageable and visible in dropdowns.
  for (const name of usedCategories) {
    const isDefault = DEFAULT_CATEGORIES.some(
      (d) => d.toLowerCase() === name.toLowerCase()
    );
    if (isDefault) continue;
    const existing = await findCategoryByInsensitiveName(name);
    if (!existing) {
      await createCategory(name, { isDefault: false, sortOrder: customSort });
      customSort += 1;
    }
  }

  // 3. Normalize FAQ.category onto the canonical default names.
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.fAQ.updateMany({
      where: { category: { equals: name, mode: "insensitive" }, NOT: { category: name } },
      data: { category: name },
    });
  }

  return prisma.fAQCategory.count();
}

module.exports = { DEFAULT_CATEGORIES, ensureDefaultFaqCategories, slugify };
