const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getAll = async (req, res, next) => {
  try {
    const pages = await prisma.cMSPAGE.findMany({ orderBy: { createdAt: "desc" } });
    const mapped = pages.map(p => ({ ...p, lastUpdated: p.updatedAt }));
    res.json({ success: true, data: mapped });
  } catch (error) { next(error); }
};

exports.getBySlug = async (req, res, next) => {
  try {
    const page = await prisma.cMSPAGE.findUnique({ where: { slug: req.params.slug } });
    if (!page) throw new AppError("Page not found", 404);
    res.json({ success: true, data: { ...page, lastUpdated: page.updatedAt } });
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const page = await prisma.cMSPAGE.findUnique({ where: { id: req.params.id } });
    if (!page) throw new AppError("Page not found", 404);
    res.json({ success: true, data: { ...page, lastUpdated: page.updatedAt } });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, slug, content, published, metaTitle, metaDescription } = req.body;
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const page = await prisma.cMSPAGE.create({
      data: {
        title,
        slug: finalSlug,
        content: content || null,
        published: published === undefined ? false : Boolean(published),
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
      },
    });
    res.status(201).json({ success: true, data: { ...page, lastUpdated: page.updatedAt } });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const { title, slug, content, published, metaTitle, metaDescription } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (slug !== undefined) data.slug = slug;
    if (content !== undefined) data.content = content;
    if (published !== undefined) data.published = Boolean(published);
    if (metaTitle !== undefined) data.metaTitle = metaTitle;
    if (metaDescription !== undefined) data.metaDescription = metaDescription;
    const page = await prisma.cMSPAGE.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: { ...page, lastUpdated: page.updatedAt } });
  } catch (error) { next(error); }
};

exports.patchStatus = async (req, res, next) => {
  try {
    const { published } = req.body;
    const data = {};
    if (published !== undefined) data.published = Boolean(published);
    const page = await prisma.cMSPAGE.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: { ...page, lastUpdated: page.updatedAt } });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.cMSPAGE.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "Page deleted" } });
  } catch (error) { next(error); }
};
