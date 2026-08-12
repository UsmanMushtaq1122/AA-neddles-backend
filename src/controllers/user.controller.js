const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getAll = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { not: "CUSTOMER" } },
      select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: users });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, email, role, password } = req.body;
    if (!email || !name) throw new AppError("Name and email are required", 400);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError("User with this email already exists", 409);
    const defaultPassword = password || "Password123!";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: role || "STAFF", isActive: true },
      select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, lastLogin: true, createdAt: true },
    });
    res.status(201).json({ success: true, data: user });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, email, role, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, lastLogin: true, createdAt: true },
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: "User deleted" } });
  } catch (error) { next(error); }
};
