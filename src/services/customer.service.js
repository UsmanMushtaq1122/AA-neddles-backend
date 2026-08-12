const prisma = require("../config/db");
const pagination = require("../utils/pagination");
const AppError = require("../utils/AppError");

const mapCustomer = (customer) => {
  if (!customer) return null;

  const orders = customer.orders || [];
  const totalOrders = orders.length;

  const totalSpent = orders
    .filter(o => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + (o.total || 0), 0);

  let lastOrder = "-";
  if (orders.length > 0) {
    const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    lastOrder = new Date(sortedOrders[0].createdAt).toISOString().split("T")[0];
  }

  const status = customer.isActive ? "active" : "inactive";
  const joinedDate = new Date(customer.createdAt).toISOString().split("T")[0];

  let parsedAddresses = [];
  if (customer.addresses) {
    try {
      parsedAddresses = typeof customer.addresses === "string" ? JSON.parse(customer.addresses) : customer.addresses;
    } catch {
      parsedAddresses = [];
    }
  }
  if (!Array.isArray(parsedAddresses)) {
    parsedAddresses = [];
  }
  if (parsedAddresses.length === 0 && customer.address) {
    parsedAddresses = [{ label: "Default Address", address: customer.address, city: "", isDefault: true }];
  }

  const mappedOrders = orders.map(o => ({
    id: o.orderNumber || o.id,
    date: new Date(o.createdAt).toISOString().split("T")[0],
    total: o.total,
    status: o.status.toLowerCase(),
    items: o.items ? o.items.length : 0
  }));

  let tier = "silver";
  if (totalSpent >= 300000) {
    tier = "platinum";
  } else if (totalSpent >= 100000) {
    tier = "gold";
  }

  return {
    ...customer,
    totalOrders,
    totalSpent,
    lastOrder,
    status,
    joinedDate,
    addresses: parsedAddresses,
    orders: mappedOrders,
    tier,
    notes: customer.notes || "",
    avatar: customer.avatar || customer.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  };
};

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
      include: { orders: { include: { items: true } } },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers: customers.map(mapCustomer), total, page: parseInt(page), totalPages: Math.ceil(total / take) };
};

exports.getCustomerById = async (id) => {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { orders: { include: { items: true } } },
  });
  if (!customer) throw new AppError("Customer not found", 404);
  return mapCustomer(customer);
};

exports.getCustomerProfile = async (userId) => {
  const customer = await prisma.customer.findUnique({
    where: { id: userId },
    include: { orders: { include: { items: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!customer) throw new AppError("Customer profile not found", 404);
  return mapCustomer(customer);
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
  if (data.isActive !== undefined) allowedData.isActive = data.isActive;
  if (data.notes !== undefined) allowedData.notes = data.notes;

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
