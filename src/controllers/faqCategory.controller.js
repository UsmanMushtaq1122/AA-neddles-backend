const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const { ensureDefaultFaqCategories, slugify } = require("../utils/faqCategoryDefaults");

async function attachUsageCount(categories, activeOnly = false) {
  return Promise.all(
    categories.map(async (c) => {
      const count = await prisma.fAQ.count({
        where: { category: c.name, ...(activeOnly ? { isActive: true } : {}) },
      });
      return { ...c, usageCount: count };
    })
  );
}

async function uniqueSlug(baseSlug) {
  const existing = await prisma.fAQCategory.findUnique({ where: { slug: baseSlug } });
  if (!existing) return baseSlug;
  let i = 1;
  while (await prisma.fAQCategory.findUnique({ where: { slug: `${baseSlug}-${i}` } })) i += 1;
  return `${baseSlug}-${i}`;
}

exports.list = async (req, res, next) => {
  try {
    await ensureDefaultFaqCategories();
    const { q, page = 1, limit = 10, active } = req.query;
    const where = {};
    if (q) where.name = { contains: q, mode: "insensitive" };
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      prisma.fAQCategory.findMany({ where, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], skip, take: Number(limit) }),
      prisma.fAQCategory.count({ where }),
    ]);
    const mapped = await attachUsageCount(items);
    res.json({ success: true, data: mapped, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } });
  } catch (error) { next(error); }
};

exports.active = async (req, res, next) => {
  try {
    await ensureDefaultFaqCategories();
    const items = await prisma.fAQCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const mapped = await attachUsageCount(items, true);
    res.json({ success: true, data: mapped });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, isActive, sortOrder } = req.body;
    if (!name || !name.trim()) throw new AppError("Name is required", 400);
    const cleanName = name.trim();
    const exists = await prisma.fAQCategory.findFirst({
      where: { name: { equals: cleanName, mode: "insensitive" } },
    });
    if (exists) throw new AppError("A category with this name already exists", 400);

    let order = sortOrder !== undefined ? parseInt(sortOrder) : null;
    if (order === null || Number.isNaN(order)) {
      const max = await prisma.fAQCategory.aggregate({ _max: { sortOrder: true } });
      order = (max._max.sortOrder ?? -1) + 1;
    }

    const category = await prisma.fAQCategory.create({
      data: {
        name: cleanName,
        slug: await uniqueSlug(slugify(cleanName)),
        isActive: isActive === undefined ? true : Boolean(isActive),
        sortOrder: order,
      },
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, isActive, sortOrder } = req.body;
    const existing = await prisma.fAQCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("Category not found", 404);

    const data = {};
    if (name !== undefined) {
      const cleanName = name.trim();
      if (!cleanName) throw new AppError("Name is required", 400);
      const duplicate = await prisma.fAQCategory.findFirst({
        where: { name: { equals: cleanName, mode: "insensitive" }, NOT: { id: req.params.id } },
      });
      if (duplicate) throw new AppError("A category with this name already exists", 400);
      data.name = cleanName;
      const slug = slugify(cleanName);
      data.slug = existing.slug === slug ? existing.slug : await uniqueSlug(slug);
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);

    const updated = await prisma.$transaction(async (tx) => {
      const category = await tx.fAQCategory.update({ where: { id: req.params.id }, data });
      if (data.name && data.name !== existing.name) {
        await tx.fAQ.updateMany({ where: { category: existing.name }, data: { category: data.name } });
      }
      return category;
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const existing = await prisma.fAQCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("Category not found", 404);
    if (existing.isDefault) throw new AppError("Default categories cannot be deleted", 400);
    const count = await prisma.fAQ.count({ where: { category: existing.name } });
    if (count > 0) {
      throw new AppError("Category is assigned to existing FAQs. Reassign or delete those FAQs first.", 400);
    }
    await prisma.fAQCategory.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "Category deleted" } });
  } catch (error) { next(error); }
};

exports.reorder = async (req, res, next) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) throw new AppError("Invalid order", 400);
    await Promise.all(
      order.map((id, idx) => prisma.fAQCategory.update({ where: { id }, data: { sortOrder: idx } }))
    );
    res.json({ success: true, data: { message: "Order updated" } });
  } catch (error) { next(error); }
};
