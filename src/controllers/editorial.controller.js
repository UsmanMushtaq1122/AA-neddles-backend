const prisma = require("../config/db");
const AppError = require("../utils/AppError");

const mapItem = (i) => ({ ...i, active: i.isActive, order: i.sortOrder, date: i.date ? i.date.toISOString().split("T")[0] : null, isActive: undefined, sortOrder: undefined });
const parseBoolean = (value, fallback) => {
  if (value === undefined) return fallback;
  return value === true || value === "true";
};

exports.getAll = async (req, res, next) => {
  try {
    const items = await prisma.eDITORIALCONTENT.findMany({ orderBy: { sortOrder: "asc" } });
    res.json({ success: true, data: items.map(mapItem) });
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await prisma.eDITORIALCONTENT.findUnique({ where: { id: req.params.id } });
    if (!item) throw new AppError("Editorial not found", 404);
    res.json({ success: true, data: mapItem(item) });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, subtitle, description, imageUrl, link, category, isActive, sortOrder } = req.body;
    const item = await prisma.eDITORIALCONTENT.create({
      data: {
        title,
        subtitle: subtitle || null,
        description: description || null,
        imageUrl: req.file?.path || imageUrl || null,
        link: link || null,
        category: category || null,
        isActive: parseBoolean(isActive, true),
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : 0,
      },
    });
    res.status(201).json({ success: true, data: mapItem(item) });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const { title, subtitle, description, imageUrl, link, category, isActive, sortOrder } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (subtitle !== undefined) data.subtitle = subtitle;
    if (description !== undefined) data.description = description;
    if (req.file) data.imageUrl = req.file.path;
    else if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (link !== undefined) data.link = link;
    if (category !== undefined) data.category = category;
    if (isActive !== undefined) data.isActive = parseBoolean(isActive, false);
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);
    const item = await prisma.eDITORIALCONTENT.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: mapItem(item) });
  } catch (error) { next(error); }
};

exports.patchStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const data = {};
    if (isActive !== undefined) data.isActive = parseBoolean(isActive, false);
    const item = await prisma.eDITORIALCONTENT.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: mapItem(item) });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.eDITORIALCONTENT.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "Editorial deleted" } });
  } catch (error) { next(error); }
};
