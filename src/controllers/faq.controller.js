const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getAll = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.active === "true") where.isActive = true;
    const faqs = await prisma.fAQ.findMany({ where, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    const mapped = faqs.map(f => ({ ...f, active: f.isActive }));
    res.json({ success: true, data: mapped });
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const faq = await prisma.fAQ.findUnique({ where: { id: req.params.id } });
    if (!faq) throw new AppError("FAQ not found", 404);
    res.json({ success: true, data: { ...faq, active: faq.isActive } });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { question, answer, category, sortOrder, active } = req.body;
    const faq = await prisma.fAQ.create({
      data: { question, answer, category, sortOrder: sortOrder ? parseInt(sortOrder) : 0, isActive: active === undefined ? true : Boolean(active) },
    });
    res.status(201).json({ success: true, data: { ...faq, active: faq.isActive } });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const { question, answer, category, sortOrder, active } = req.body;
    const data = {};
    if (question !== undefined) data.question = question;
    if (answer !== undefined) data.answer = answer;
    if (category !== undefined) data.category = category;
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);
    if (active !== undefined) data.isActive = Boolean(active);
    const faq = await prisma.fAQ.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: { ...faq, active: faq.isActive } });
  } catch (error) { next(error); }
};

exports.patchStatus = async (req, res, next) => {
  try {
    const { active } = req.body;
    const data = {};
    if (active !== undefined) data.isActive = Boolean(active);
    const faq = await prisma.fAQ.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: { ...faq, active: faq.isActive } });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.fAQ.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "FAQ deleted" } });
  } catch (error) { next(error); }
};
