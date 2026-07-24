const prisma = require("../config/db");
const slugify = require("../utils/slugify");
const generateSKU = require("../utils/generateSKU");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");
const { extractPublicIdFromUrl, deleteFromCloudinary, enrichArrayWithOptimizedUrls, enrichWithOptimizedUrls } = require("../utils/cloudinary");

exports.getAllProducts = async (query) => {
  const { page = 1, limit = 10, search, categoryId, minPrice, maxPrice, sortBy = "createdAt", sortOrder = "desc" } = query;
  const skip = pagination.getSkip(page, limit);
  const take = Math.min(parseInt(limit), 100);

  const where = {};
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (categoryId) where.categoryId = categoryId;
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  const allowedSorts = ["createdAt", "price", "name", "stock"];
  const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : "createdAt";
  const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      skip,
      take,
      orderBy: { [safeSortBy]: safeSortOrder },
    }),
    prisma.product.count({ where }),
  ]);

  return { products: enrichArrayWithOptimizedUrls(products), total, page: parseInt(page), totalPages: Math.ceil(total / take) };
};

exports.getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, reviews: { include: { customer: true } } },
  });
  if (!product) throw new AppError("Product not found", 404);
  return enrichWithOptimizedUrls(product);
};

exports.createProduct = async (data, file) => {
  const slug = slugify(data.name);
  const sku = data.sku || generateSKU(data.name);
  const image = file ? file.path : null;
  const imagePublicId = file ? file.filename : null;

  const allowedData = {
    name: data.name,
    description: data.description,
    price: parseFloat(data.price),
    stock: parseInt(data.stock),
    categoryId: data.categoryId,
    slug,
    sku,
    image,
    imagePublicId,
  };

  try {
    const created = await prisma.product.create({ data: allowedData });
    return enrichWithOptimizedUrls(created);
  } catch (err) {
    if (imagePublicId) {
      await deleteFromCloudinary(imagePublicId).catch(() => {});
    }
    if (err.code === "P2002") {
      throw new AppError("A product with this name or SKU already exists", 409);
    }
    throw err;
  }
};

exports.updateProduct = async (id, data, file) => {
  const existingProduct = await prisma.product.findUnique({ where: { id } });
  if (!existingProduct) throw new AppError("Product not found", 404);

  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.name) updateData.slug = slugify(data.name);
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = parseFloat(data.price);
  if (data.stock !== undefined) updateData.stock = parseInt(data.stock);
  if (data.categoryId) updateData.categoryId = data.categoryId;
  if (data.sku) updateData.sku = data.sku;

  let oldPublicId = null;
  if (file) {
    updateData.image = file.path;
    updateData.imagePublicId = file.filename;
    oldPublicId = existingProduct.imagePublicId || extractPublicIdFromUrl(existingProduct.image);
  }

  try {
    const updated = await prisma.product.update({ where: { id }, data: updateData });
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }
    return enrichWithOptimizedUrls(updated);
  } catch (err) {
    if (file && file.filename) {
      await deleteFromCloudinary(file.filename).catch(() => {});
    }
    if (err.code === "P2002") {
      throw new AppError("A product with this name or SKU already exists", 409);
    }
    throw err;
  }
};

exports.bulkUploadImages = async (files) => {
  if (!files || files.length === 0) throw new AppError("No image files provided", 400);
  return files.map((f) => ({
    url: f.path,
    publicId: f.filename,
    optimizedImage: enrichWithOptimizedUrls({ imagePublicId: f.filename }).optimizedImage,
  }));
};

exports.deleteProduct = async (id) => {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError("Product not found", 404);

  const hasOrders = await prisma.orderItem.findFirst({ where: { productId: id } });
  if (hasOrders) {
    throw new AppError("Cannot delete product with existing orders", 409);
  }

  const publicId = product.imagePublicId || extractPublicIdFromUrl(product.image);

  await prisma.product.delete({ where: { id } });

  if (publicId) {
    await deleteFromCloudinary(publicId);
  }
  return { message: "Product deleted successfully" };
};
