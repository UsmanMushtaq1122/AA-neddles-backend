const prisma = require("../config/db");
const slugify = require("../utils/slugify");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");
const { extractPublicIdFromUrl, deleteFromCloudinary, enrichArrayWithOptimizedUrls, enrichWithOptimizedUrls } = require("../utils/cloudinary");

exports.getAllCategories = async (query) => {
  const { page = 1, limit = 10 } = query;
  const skip = pagination.getSkip(page, limit);
  const take = Math.min(parseInt(limit), 100);

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.count(),
  ]);

  return { categories: enrichArrayWithOptimizedUrls(categories), total, page: parseInt(page), totalPages: Math.ceil(total / take) };
};

exports.getCategoryById = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { products: true },
  });
  if (!category) throw new AppError("Category not found", 404);
  return enrichWithOptimizedUrls(category);
};

exports.createCategory = async (data, file) => {
  const slug = slugify(data.name);
  const image = file ? file.path : null;
  const imagePublicId = file ? file.filename : null;

  try {
    const created = await prisma.category.create({
      data: { name: data.name, slug, description: data.description, image, imagePublicId },
    });
    return enrichWithOptimizedUrls(created);
  } catch (err) {
    if (imagePublicId) {
      await deleteFromCloudinary(imagePublicId).catch(() => {});
    }
    if (err.code === "P2002") {
      throw new AppError("A category with this name already exists", 409);
    }
    throw err;
  }
};

exports.updateCategory = async (id, data, file) => {
  const existingCategory = await prisma.category.findUnique({ where: { id } });
  if (!existingCategory) throw new AppError("Category not found", 404);

  const updateData = {};
  if (data.name) {
    updateData.name = data.name;
    updateData.slug = slugify(data.name);
  }
  if (data.description !== undefined) updateData.description = data.description;

  let oldPublicId = null;
  if (file) {
    updateData.image = file.path;
    updateData.imagePublicId = file.filename;
    oldPublicId = existingCategory.imagePublicId || extractPublicIdFromUrl(existingCategory.image);
  }

  try {
    const updated = await prisma.category.update({ where: { id }, data: updateData });
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }
    return enrichWithOptimizedUrls(updated);
  } catch (err) {
    if (file && file.filename) {
      await deleteFromCloudinary(file.filename).catch(() => {});
    }
    if (err.code === "P2002") {
      throw new AppError("A category with this name already exists", 409);
    }
    throw err;
  }
};

exports.deleteCategory = async (id) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new AppError("Category not found", 404);

  const hasProducts = await prisma.product.findFirst({ where: { categoryId: id } });
  if (hasProducts) {
    throw new AppError("Cannot delete category with existing products", 409);
  }

  const publicId = category.imagePublicId || extractPublicIdFromUrl(category.image);

  await prisma.category.delete({ where: { id } });

  if (publicId) {
    await deleteFromCloudinary(publicId);
  }
  return { message: "Category deleted successfully" };
};
