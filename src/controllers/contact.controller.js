const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getAll = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    const messages = await prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json({ success: true, data: messages });
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const message = await prisma.contactMessage.findUnique({ where: { id: req.params.id } });
    if (!message) throw new AppError("Message not found", 404);
    res.json({ success: true, data: message });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message: msgText } = req.body;
    if (!name || !email || !subject || !msgText) {
      throw new AppError("Name, email, subject, and message are required", 400);
    }
    const message = await prisma.contactMessage.create({
      data: { name, email, phone, subject, message: msgText },
    });
    res.status(201).json({ success: true, data: message });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const message = await prisma.contactMessage.update({
      where: { id: req.params.id },
      data: { ...(status && { status }), ...(notes !== undefined && { notes }) },
    });
    res.json({ success: true, data: message });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.contactMessage.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "Message deleted" } });
  } catch (error) { next(error); }
};
