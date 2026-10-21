const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getAll = async (req, res, next) => {
  try {
    const settings = await prisma.siteSetting.findMany();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

exports.getByKey = async (req, res, next) => {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: req.params.key } });
    if (!setting) throw new AppError("Setting not found", 404);
    res.json({ success: true, data: { [setting.key]: setting.value } });
  } catch (error) { next(error); }
};

exports.upsert = async (req, res, next) => {
  try {
    const setting = await prisma.siteSetting.upsert({
      where: { key: req.params.key },
      update: { value: req.body.value },
      create: { key: req.params.key, value: req.body.value },
    });
    res.json({ success: true, data: { [setting.key]: setting.value } });
  } catch (error) { next(error); }
};

exports.upsertAll = async (req, res, next) => {
  try {
    const entries = Object.entries(req.body);
    const settings = await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.siteSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );
    const result = {};
    settings.forEach((setting) => {
      result[setting.key] = setting.value;
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.siteSetting.delete({ where: { key: req.params.key } });
    res.json({ success: true, data: { message: "Setting deleted" } });
  } catch (error) { next(error); }
};
