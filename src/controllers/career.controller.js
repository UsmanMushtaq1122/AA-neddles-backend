const prisma = require("../config/db");
const AppError = require("../utils/AppError");

function parseRequirements(data) {
  if (data.requirements && typeof data.requirements === "string") {
    try { data.requirements = JSON.parse(data.requirements); }
    catch { data.requirements = data.requirements.split(",").map(s => s.trim()); }
  }
  return data;
}

exports.getAll = async (req, res, next) => {
  try {
    const careers = await prisma.career.findMany({ orderBy: { createdAt: "desc" } });
    const mapped = careers.map(c => ({ ...c, active: c.isActive }));
    res.json({ success: true, data: mapped });
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const career = await prisma.career.findUnique({ where: { id: req.params.id } });
    if (!career) throw new AppError("Career not found", 404);
    res.json({ success: true, data: { ...career, active: career.isActive } });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, department, location, type, description, requirements, salary, isActive, active } = req.body;
    if (!title || !department || !description) {
      throw new AppError("Title, department, and description are required", 400);
    }
    const parsedReqs = parseRequirements({ requirements });
    const career = await prisma.career.create({
      data: { title, department, location, type, description, requirements: parsedReqs.requirements, salary, isActive: active !== undefined ? Boolean(active) : isActive !== false },
    });
    res.status(201).json({ success: true, data: { ...career, active: career.isActive } });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const career = await prisma.career.findUnique({ where: { id: req.params.id } });
    if (!career) throw new AppError("Career not found", 404);

    const { title, department, location, type, description, requirements, salary, isActive, active } = req.body;
    const data = {};
    if (title) data.title = title;
    if (department) data.department = department;
    if (location !== undefined) data.location = location;
    if (type !== undefined) data.type = type;
    if (description) data.description = description;
    if (requirements !== undefined) {
      const parsed = parseRequirements({ requirements });
      data.requirements = parsed.requirements;
    }
    if (salary !== undefined) data.salary = salary;
    if (isActive !== undefined) data.isActive = isActive;
    if (active !== undefined) data.isActive = Boolean(active);

    const updated = await prisma.career.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: { ...updated, active: updated.isActive } });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.career.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "Career deleted" } });
  } catch (error) { next(error); }
};

exports.apply = async (req, res, next) => {
  try {
    const career = await prisma.career.findUnique({ where: { id: req.params.id } });
    if (!career) throw new AppError("Career not found", 404);
    if (!career.isActive) throw new AppError("This position is no longer open", 400);

    const { name, email, phone, portfolio, message } = req.body;
    const application = await prisma.jobApplication.create({
      data: { careerId: career.id, name, email, phone: phone || null, portfolio: portfolio || null, message: message || null },
    });
    res.status(201).json({ success: true, data: { ...application, jobTitle: career.title } });
  } catch (error) { next(error); }
};

exports.listApplications = async (req, res, next) => {
  try {
    const applications = await prisma.jobApplication.findMany({
      include: { career: { select: { id: true, title: true, department: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: applications });
  } catch (error) { next(error); }
};
