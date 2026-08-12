const prisma = require("../config/db");
const slugify = require("../utils/slugify");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");

exports.getAllCategories = async (query) => {
  const { page = 1, limit = 100 } = query;
  const skip = pagination.getSkip(page, limit);
  const take = Math.min(parseInt(limit), 100);

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
        children: { include: { _count: { select: { products: true } } } },
      },
      skip,
      take,
      orderBy: { sortOrder: "asc" },
    }),
    prisma.category.count(),
  ]);

  return { categories, total, page: parseInt(page), totalPages: Math.ceil(total / take) };
};

exports.getCategoryById = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      products: true,
      children: { include: { _count: { select: { products: true } } } },
      parent: true,
    },
  });
  if (!category) throw new AppError("Category not found", 404);
  return category;
};

exports.getCategoryBySlug = async (slug) => {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      products: true,
      children: { include: { _count: { select: { products: true } } } },
      parent: true,
    },
  });
  if (!category) throw new AppError("Category not found", 404);
  return category;
};

exports.createCategory = async (data, file) => {
  const slug = slugify(data.name);

  const createData = {
    name: data.name,
    slug,
    description: data.description,
    sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder) : 0,
    isActive: data.isActive !== undefined ? data.isActive === "true" || data.isActive === true : true,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    parentId: data.parentId || undefined,
  };

  if (file) {
    createData.image = file.path;
    createData.imagePublicId = file.filename;
  } else if (data.image) {
    createData.image = data.image;
  }

  try {
    const created = await prisma.category.create({
      data: createData,
      include: { children: true, parent: true },
    });
    return created;
  } catch (err) {
    if (err.code === "P2002") {
      throw new AppError("A category with this name already exists", 409);
    }
    throw err;
  }
};

exports.updateCategory = async (id, data, file) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404);

  const updateData = {};
  if (data.name) { updateData.name = data.name; updateData.slug = slugify(data.name); }
  if (data.description !== undefined) updateData.description = data.description;
  if (data.sortOrder !== undefined) updateData.sortOrder = parseInt(data.sortOrder);
  if (data.isActive !== undefined) updateData.isActive = data.isActive === "true" || data.isActive === true;
  if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle;
  if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription;
  if (data.parentId !== undefined) updateData.parentId = data.parentId || null;

  if (file) {
    updateData.image = file.path;
    updateData.imagePublicId = file.filename;
  } else if (data.image !== undefined) {
    updateData.image = data.image;
  }

  try {
    const updated = await prisma.category.update({
      where: { id },
      data: updateData,
      include: { children: true, parent: true },
    });
    return updated;
  } catch (err) {
    if (err.code === "P2002") {
      throw new AppError("A category with this name already exists", 409);
    }
    throw err;
  }
};

exports.deleteCategory = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true, children: true } },
    },
  });
  if (!category) throw new AppError("Category not found", 404);

  // Products must always belong to a category. Preserve them by moving them to
  // the fallback category before deleting the selected category.
  if (category.slug === "uncategorized" && category._count.products > 0) {
    throw new AppError("Cannot delete the Uncategorized category while it contains products", 409);
  }

  await prisma.$transaction(async (tx) => {
    if (category._count.products > 0) {
      const uncategorized = await tx.category.upsert({
        where: { slug: "uncategorized" },
        update: {},
        create: {
          name: "Uncategorized",
          slug: "uncategorized",
          description: "Products moved here after their category is deleted.",
          isActive: true,
        },
      });

      await tx.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: uncategorized.id },
      });
    }

    // Keep subcategories available and retain the hierarchy where possible.
    if (category._count.children > 0) {
      await tx.category.updateMany({
        where: { parentId: id },
        data: { parentId: category.parentId },
      });
    }

    await tx.category.delete({ where: { id } });
  });

  return {
    message: "Category deleted successfully",
    movedProducts: category._count.products,
    reparentedSubcategories: category._count.children,
  };
};
