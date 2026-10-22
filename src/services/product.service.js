const prisma = require("../config/db");
const slugify = require("../utils/slugify");
const generateSKU = require("../utils/generateSKU");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");

const FALLBACK_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Custom", "One Size"];

const FALLBACK_FABRICS = [
  "Lawn",
  "Cotton",
  "Silk",
  "Velvet",
  "Chiffon",
  "Organza",
  "Georgette",
  "Linen",
  "Premium Lawn",
];

const KNOWN_SIZES = [...FALLBACK_SIZES, "Free Size", "2XL"];

const KNOWN_FABRICS = [
  "Premium Lawn",
  "Lawn",
  "Cotton",
  "Silk",
  "Velvet",
  "Chiffon",
  "Organza",
  "Georgette",
  "Linen",
  "Wool",
  "Denim",
  "Rayon",
  "Khaddar",
  "Net",
  "Tulle",
];

function formatPrice(value) {
  try {
    return value.toLocaleString("en-PK");
  } catch {
    return value.toLocaleString("en-US");
  }
}

function niceStep(value) {
  if (!isFinite(value) || value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const factor = value / pow;
  const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
  return nice * pow;
}

function collectProductTags(products) {
  const tags = new Set();
  for (const product of products) {
    let raw = product.tags;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { raw = []; }
    }
    if (Array.isArray(raw)) {
      for (const tag of raw) {
        if (typeof tag === "string" && tag.trim()) tags.add(tag.trim());
      }
    }
  }
  return [...tags];
}

function orderByKnown(values, known) {
  return values
    .filter((v) => known.includes(v))
    .sort((a, b) => known.indexOf(a) - known.indexOf(b));
}

function deriveSizes(products) {
  const productSizes = [...new Set(products.flatMap((product) => normalizeStringArray(product.sizes)))];
  if (productSizes.length > 0) return productSizes;

  const sizes = orderByKnown(
    collectProductTags(products)
      .map((tag) => KNOWN_SIZES.find((s) => s.toLowerCase() === tag.toLowerCase()))
      .filter(Boolean),
    KNOWN_SIZES
  );
  return sizes.length > 0 ? [...new Set(sizes)] : FALLBACK_SIZES;
}

function deriveFabrics(products) {
  const fabrics = orderByKnown(
    collectProductTags(products)
      .map((tag) => KNOWN_FABRICS.find((f) => f.toLowerCase() === tag.toLowerCase()))
      .filter(Boolean),
    KNOWN_FABRICS
  );
  return fabrics.length > 0 ? [...new Set(fabrics)] : FALLBACK_FABRICS;
}

function buildPriceRanges(products) {
  const prices = products
    .map((p) => parseFloat(p.price))
    .filter((p) => isFinite(p) && p > 0);
  if (prices.length === 0) return [];

  const max = Math.max(...prices);
  const step = Math.max(1, niceStep(max / 5));
  const ranges = [];

  for (let i = 0; i < 4; i += 1) {
    const min = i * step;
    const bandMax = (i + 1) * step;
    ranges.push({
      label: i === 0
        ? `Under Rs. ${formatPrice(bandMax)}`
        : `Rs. ${formatPrice(min)} - Rs. ${formatPrice(bandMax)}`,
      min: i === 0 ? null : min,
      max: bandMax,
      count: prices.filter((p) => p >= min && p <= bandMax).length,
    });
  }

  const aboveMin = 4 * step;
  ranges.push({
    label: `Above Rs. ${formatPrice(aboveMin)}`,
    min: aboveMin,
    max: null,
    count: prices.filter((p) => p > aboveMin).length,
  });

  return ranges;
}

function deriveCollections(products, categories) {
  const collections = [];
  if (products.some((p) => p.isNewArrival)) {
    collections.push({ label: "New Arrivals", slug: "new-arrivals" });
  }
  const categoryIdsWithProducts = new Set(products.map((p) => p.categoryId));
  const active = categories.filter((c) => categoryIdsWithProducts.has(c.id));
  const parents = active.filter((c) => !c.parentId);
  const children = active.filter((c) => c.parentId);
  for (const category of [...parents, ...children]) {
    collections.push({ label: category.name, slug: category.slug });
  }
  return collections;
}

function parseJsonField(value) {
  if (!value) return undefined;
  if (typeof value === "string") {
    try { return JSON.parse(value); }
    catch { return value; }
  }
  return value;
}

function normalizeStringArray(value) {
  const parsed = parseJsonField(value);
  return Array.isArray(parsed)
    ? parsed.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
}

function mapProductAttributes(product) {
  const sizes = normalizeStringArray(product.sizes);
  return {
    ...product,
    sizes: sizes.length > 0 ? sizes : ["XS", "S", "M", "L", "XL", "Custom"],
    careInstructions: normalizeStringArray(product.careInstructions),
  };
}

const mapProduct = (product) => {
  if (!product) return null;

  const productAttributes = mapProductAttributes(product);
  const title = product.name;

  let images = [];
  if (product.images) {
    let rawImages = product.images;
    if (typeof rawImages === "string") {
      try { rawImages = JSON.parse(rawImages); } catch { rawImages = []; }
    }
    if (Array.isArray(rawImages)) {
      images = rawImages.map(img => {
        if (typeof img === "string") return img;
        if (img && typeof img === "object" && img.url) return img.url;
        return null;
      }).filter(Boolean);
    }
  }

  if (images.length === 0) {
    const num = (product.id ? product.id.charCodeAt(product.id.length - 1) % 11 : 0) + 1;
    images = [`/images/AA${num}.jpeg`, `/images/AA${((num + 1) % 11) + 1}.jpeg`];
  }

  let tags = [];
  if (product.tags) {
    let rawTags = product.tags;
    if (typeof rawTags === "string") {
      try { rawTags = JSON.parse(rawTags); } catch { rawTags = []; }
    }
    if (Array.isArray(rawTags)) {
      tags = rawTags;
    }
  }

  const fabric = product.fabric || "Cotton & Silk Blend";

  let categoryLabel = "Pret";
  if (product.category) {
    categoryLabel = product.category.slug || product.category.name || "Pret";
  }

  const productPrice = parseFloat(product.price) || 0;
  const productCompareAt = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const salePrice = productCompareAt && productCompareAt > productPrice ? productPrice : null;
  const displayPrice = salePrice ? productCompareAt : productPrice;

  return {
    ...productAttributes,
    title,
    price: displayPrice,
    compareAtPrice: productCompareAt,
    salePrice,
    images,
    tags,
    fabric,
    category: categoryLabel,
  };
};

exports.getAllProducts = async (query) => {
  const { page = 1, limit = 10, search, categoryId, minPrice, maxPrice, status, isFeatured, isNewArrival, isBestSeller, sortBy = "createdAt", sortOrder = "desc" } = query;
  const skip = pagination.getSkip(page, limit);
  const take = Math.min(parseInt(limit), 100);

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { shortDescription: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { category: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  if (isFeatured !== undefined) where.isFeatured = isFeatured === "true";
  if (isNewArrival !== undefined) where.isNewArrival = isNewArrival === "true";
  if (isBestSeller !== undefined) where.isBestSeller = isBestSeller === "true";
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

  return { products: products.map(mapProduct), total, page: parseInt(page), totalPages: Math.ceil(total / take) };
};

exports.getProductFacets = async (query) => {
  const requestedStatus = query.status ? String(query.status).toUpperCase() : "ACTIVE";
  const status = ["ACTIVE", "DRAFT", "ARCHIVED"].includes(requestedStatus) ? requestedStatus : "ACTIVE";

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { status },
      select: {
        price: true,
        compareAtPrice: true,
        tags: true,
        sizes: true,
        isNewArrival: true,
        categoryId: true,
      },
    }),
    prisma.category.findMany({ where: { isActive: true } }),
  ]);

  const prices = products
    .map((p) => parseFloat(p.price))
    .filter((p) => isFinite(p) && p > 0);

  return {
    priceRanges: buildPriceRanges(products),
    sizes: deriveSizes(products),
    fabrics: deriveFabrics(products),
    collections: deriveCollections(products, categories),
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
  };
};

exports.getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, reviews: { include: { customer: true } } },
  });
  if (!product) throw new AppError("Product not found", 404);
  return mapProduct(product);
};

exports.getProductBySlug = async (slug) => {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { category: true, reviews: { include: { customer: true } } },
  });
  if (!product) throw new AppError("Product not found", 404);
  return mapProduct(product);
};

async function findDuplicateFields({ name, sku, slug, excludeId }) {
  const exclude = excludeId ? { NOT: { id: excludeId } } : {};
  const duplicates = {};

  if (name && String(name).trim()) {
    const byName = await prisma.product.findFirst({
      where: { ...exclude, name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (byName) duplicates.name = "A product with this name already exists.";
  }

  const resolvedSlug =
    slug && String(slug).trim() ? slug.trim() : name ? slugify(name) : null;
  if (resolvedSlug) {
    const bySlug = await prisma.product.findFirst({
      where: { ...exclude, slug: resolvedSlug },
      select: { id: true },
    });
    if (bySlug) duplicates.slug = "This product slug already exists.";
  }

  if (sku && String(sku).trim()) {
    const bySku = await prisma.product.findUnique({
      where: { sku: sku.trim() },
      select: { id: true },
    });
    if (bySku && (!excludeId || bySku.id !== excludeId)) {
      duplicates.sku = "This SKU is already in use.";
    }
  }

  return duplicates;
}

function throwFirstDuplicate(duplicates) {
  const message = duplicates.name || duplicates.sku || duplicates.slug;
  if (message) throw new AppError(message, 409);
}

exports.checkProductDuplicates = async ({ name, sku, slug, excludeId }) =>
  findDuplicateFields({ name, sku, slug, excludeId });

exports.createProduct = async (data, file) => {
  const slug = slugify(data.name);
  const sku = data.sku || generateSKU(data.name);

  throwFirstDuplicate(await findDuplicateFields({ name: data.name, sku, slug }));

  const images = [];
  if (file) {
    images.push({ id: `img-${Date.now()}`, url: file.path, alt: data.name, sortOrder: 0 });
  }

  const allowedData = {
    name: data.name,
    slug,
    description: data.description,
    shortDescription: data.shortDescription,
    price: parseFloat(data.price),
    compareAtPrice: data.compareAtPrice ? parseFloat(data.compareAtPrice) : undefined,
    costPrice: data.costPrice ? parseFloat(data.costPrice) : undefined,
    stock: parseInt(data.stock) || 0,
    lowStockThreshold: parseInt(data.lowStockThreshold) || 5,
    sku,
    barcode: data.barcode || null,
    weight: data.weight ? parseFloat(data.weight) : undefined,
    status: data.status ? (data.status === "active" ? "ACTIVE" : data.status === "draft" ? "DRAFT" : data.status === "archived" ? "ARCHIVED" : data.status.toUpperCase()) : "ACTIVE",
    isFeatured: data.isFeatured === "true" || data.isFeatured === true,
    isNewArrival: data.isNewArrival === "true" || data.isNewArrival === true,
    isBestSeller: data.isBestSeller === "true" || data.isBestSeller === true,
    images: parseJsonField(data.images) || images,
    tags: parseJsonField(data.tags) || [],
    sizes: parseJsonField(data.sizes),
    careInstructions: parseJsonField(data.careInstructions),
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    categoryId: data.categoryId,
  };

  try {
    const created = await prisma.product.create({ data: allowedData, include: { category: true } });
    return mapProductAttributes(created);
  } catch (err) {
    if (err.code === "P2002") {
      const targetFields = Array.isArray(err.meta?.target) ? err.meta.target : [];
      const conflictField = targetFields.includes("sku")
        ? "SKU"
        : targetFields.includes("slug")
        ? "slug"
        : targetFields.includes("barcode")
        ? "barcode"
        : "product";
      throw new AppError(`A product with this ${conflictField} already exists`, 409);
    }
    throw err;
  }
};

exports.updateProduct = async (id, data, file) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError("Product not found", 404);

  const nextSlug = data.name ? slugify(data.name) : existing.slug;
  const nextSku = data.sku || existing.sku;
  throwFirstDuplicate(
    await findDuplicateFields({
      name: data.name || existing.name,
      sku: nextSku,
      slug: nextSlug,
      excludeId: id,
    })
  );

  const updateData = {};
  if (data.name) { updateData.name = data.name; updateData.slug = slugify(data.name); }
  if (data.description !== undefined) updateData.description = data.description;
  if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription;
  if (data.price !== undefined) {
    const parsedPrice = parseFloat(data.price);
    if (!isFinite(parsedPrice)) throw new AppError("Invalid price value", 400);
    updateData.price = parsedPrice;
  }
  if (data.compareAtPrice !== undefined) updateData.compareAtPrice = parseFloat(data.compareAtPrice);
  if (data.costPrice !== undefined) updateData.costPrice = parseFloat(data.costPrice);
  if (data.stock !== undefined) {
    const parsedStock = parseInt(data.stock);
    if (parsedStock < 0) throw new AppError("Stock cannot be negative", 400);
    updateData.stock = parsedStock;
  }
  if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = parseInt(data.lowStockThreshold);
  if (data.sku) updateData.sku = data.sku;
  if (data.barcode !== undefined) updateData.barcode = data.barcode || null;
  if (data.weight !== undefined) updateData.weight = parseFloat(data.weight);
  if (data.status) {
    updateData.status = data.status === "active" ? "ACTIVE" : data.status === "draft" ? "DRAFT" : data.status === "archived" ? "ARCHIVED" : data.status.toUpperCase();
  }
  if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured === "true" || data.isFeatured === true;
  if (data.isNewArrival !== undefined) updateData.isNewArrival = data.isNewArrival === "true" || data.isNewArrival === true;
  if (data.isBestSeller !== undefined) updateData.isBestSeller = data.isBestSeller === "true" || data.isBestSeller === true;
  if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle;
  if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription;
  if (data.categoryId) updateData.categoryId = data.categoryId;

  if (data.tags !== undefined) updateData.tags = parseJsonField(data.tags);
  if (data.sizes !== undefined) updateData.sizes = parseJsonField(data.sizes);
  if (data.careInstructions !== undefined) updateData.careInstructions = parseJsonField(data.careInstructions);
  if (data.images !== undefined) {
    updateData.images = parseJsonField(data.images);
  } else if (file) {
    const existingImages = typeof existing.images === "string" ? JSON.parse(existing.images) : existing.images || [];
    updateData.images = [...existingImages, { id: `img-${Date.now()}`, url: file.path, alt: data.name || existing.name, sortOrder: existingImages.length }];
  }

  try {
    const updated = await prisma.product.update({ where: { id }, data: updateData, include: { category: true } });
    return mapProductAttributes(updated);
  } catch (err) {
    if (err.code === "P2002") {
      throw new AppError("This product already exists.", 409);
    }
    throw err;
  }
};

exports.bulkUploadImages = async (files) => {
  if (!files || files.length === 0) throw new AppError("No image files provided", 400);
  return files.map((f) => ({
    url: f.path,
    publicId: f.filename,
  }));
};

exports.deleteProduct = async (id) => {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError("Product not found", 404);

  const hasOrders = await prisma.orderItem.findFirst({ where: { productId: id } });
  if (hasOrders) {
    throw new AppError("Cannot delete product with existing orders", 409);
  }

  await prisma.product.delete({ where: { id } });
  return { message: "Product deleted successfully" };
};
