const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getAll = async (req, res, next) => {
  try {
    const locations = await prisma.storeLocation.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, data: locations });
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const location = await prisma.storeLocation.findUnique({ where: { id: req.params.id } });
    if (!location) throw new AppError("Location not found", 404);
    res.json({ success: true, data: location });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, address, phone, email, city, province, latitude, longitude, hours, isActive } = req.body;
    if (!name || !address) {
      throw new AppError("Name and address are required", 400);
    }
    const location = await prisma.storeLocation.create({
      data: { name, address, phone, email, city, province, latitude: latitude ? parseFloat(latitude) : null, longitude: longitude ? parseFloat(longitude) : null, hours, isActive: isActive !== false },
    });
    res.status(201).json({ success: true, data: location });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const location = await prisma.storeLocation.findUnique({ where: { id: req.params.id } });
    if (!location) throw new AppError("Location not found", 404);

    const { name, address, phone, email, city, province, latitude, longitude, hours, isActive } = req.body;
    const data = {};
    if (name) data.name = name;
    if (address) data.address = address;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (city !== undefined) data.city = city;
    if (province !== undefined) data.province = province;
    if (latitude !== undefined) data.latitude = parseFloat(latitude);
    if (longitude !== undefined) data.longitude = parseFloat(longitude);
    if (hours !== undefined) data.hours = hours;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.storeLocation.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.storeLocation.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "Location deleted" } });
  } catch (error) { next(error); }
};
