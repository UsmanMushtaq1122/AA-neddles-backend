const prisma = require("../config/db");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");

exports.getAllCustomers = async (query) => {
  const { page = 1, limit = 10, search } = query;
  const skip = pagination.getSkip(page, limit);
  const take = Math.min(parseInt(limit), 100);

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total, page: parseInt(page), totalPages: Math.ceil(total / take) };
};

exports.getCustomerById = async (id) => {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { orders: { include: { items: true } } },
  });
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

exports.getCustomerProfile = async (userId) => {
  const customer = await prisma.customer.findUnique({
    where: { id: userId },
    include: { orders: { include: { items: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!customer) throw new AppError("Customer profile not found", 404);
  return customer;
};

exports.updateCustomer = async (id, data, userRole, userId) => {
  if (userRole !== "ADMIN" && userId !== id) {
    throw new AppError("You can only update your own profile", 403);
  }

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new AppError("Customer not found", 404);

  const allowedData = {};
  if (data.name) allowedData.name = data.name;
  if (data.phone !== undefined) allowedData.phone = data.phone;
  if (data.address !== undefined) allowedData.address = data.address;

  return prisma.customer.update({ where: { id }, data: allowedData });
};

exports.deleteCustomer = async (id) => {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new AppError("Customer not found", 404);

  const hasOrders = await prisma.order.findFirst({ where: { customerId: id } });
  if (hasOrders) {
    throw new AppError("Cannot delete customer with existing orders", 409);
  }

  await prisma.customer.delete({ where: { id } });
  return { message: "Customer deleted successfully" };
};
