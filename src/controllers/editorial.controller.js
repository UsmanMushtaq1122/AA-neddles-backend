const prisma = require("../config/db");
const AppError = require("../utils/AppError");

// Responses expose both the EditorialContent column names and the aliases the
// admin Collections screen reads (`name`, `slug`, `image`), plus `active` and
// `order`. Nothing is stripped so `isActive`/`sortOrder` stay available.
const mapItem = (i) => ({
  ...i,
  name: i.title,
  slug: i.subtitle || "",
  image: i.imageUrl || "",
  active: i.isActive,
  order: i.sortOrder,
  date: i.date ? i.date.toISOString().split("T")[0] : null,
});

exports.getAll = async (req, res, next) => {
  try {
    const items = await prisma.editorialContent.findMany({
      orderBy: { sortOrder: "asc" },
    });
    res.json({ success: true, data: items.map(mapItem) });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await prisma.editorialContent.findUnique({
      where: { id: req.params.id },
    });
    if (!item) throw new AppError("Editorial not found", 404);
    res.json({ success: true, data: mapItem(item) });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      title,
      name,
      subtitle,
      slug,
      description,
      imageUrl,
      image,
      link,
      category,
      isActive,
      active,
      sortOrder,
    } = req.body;
    const requestedActive = isActive !== undefined ? isActive : active;
    const uploadedUrl = req.file ? req.file.path || req.file.secure_url : null;
    const finalImage = uploadedUrl || imageUrl || image || null;

    const item = await prisma.editorialContent.create({
      data: {
        title: title || name,
        subtitle: subtitle || slug || null,
        description: description || null,
        imageUrl: finalImage,
        link: link || null,
        category: category || null,
        isActive: requestedActive === undefined ? true : Boolean(requestedActive),
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : 0,
      },
    });
    res.status(201).json({ success: true, data: mapItem(item) });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const {
      title,
      name,
      subtitle,
      slug,
      description,
      imageUrl,
      image,
      link,
      category,
      isActive,
      active,
      sortOrder,
    } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    else if (name !== undefined) data.title = name;

    if (subtitle !== undefined) data.subtitle = subtitle;
    else if (slug !== undefined) data.subtitle = slug;

    if (description !== undefined) data.description = description;

    const uploadedUrl = req.file ? req.file.path || req.file.secure_url : null;
    if (uploadedUrl) data.imageUrl = uploadedUrl;
    else if (imageUrl !== undefined) data.imageUrl = imageUrl;
    else if (image !== undefined) data.imageUrl = image;

    if (link !== undefined) data.link = link;
    if (category !== undefined) data.category = category;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    else if (active !== undefined) data.isActive = Boolean(active);
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder, 10);

    const item = await prisma.editorialContent.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: mapItem(item) });
  } catch (error) {
    next(error);
  }
};

exports.patchStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const data = {};
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    const item = await prisma.editorialContent.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: mapItem(item) });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.editorialContent.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "Editorial deleted" } });
  } catch (error) {
    next(error);
  }
};
