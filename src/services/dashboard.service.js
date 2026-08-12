const prisma = require("../config/db");

exports.getStats = async () => {
  const [totalProducts, totalOrders, totalCustomers, totalRevenue, pendingOrders] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.customer.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: "DELIVERED" } }),
    prisma.order.count({ where: { status: "PENDING" } }),
  ]);

  return {
    totalProducts,
    totalOrders,
    totalCustomers,
    totalRevenue: Number(totalRevenue._sum.total) || 0,
    pendingOrders,
  };
};

exports.getSalesData = async ({ startDate, endDate }) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const where = {
    createdAt: {
      gte: startDate ? new Date(startDate) : thirtyDaysAgo,
      ...(endDate ? { lte: new Date(endDate) } : {}),
    },
    status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] },
  };

  const orders = await prisma.order.findMany({
    where,
    select: {
      createdAt: true,
      total: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const salesMap = {};
  for (const order of orders) {
    const dateKey = order.createdAt.toISOString().slice(0, 10);
    if (!salesMap[dateKey]) {
      salesMap[dateKey] = { date: dateKey, orderCount: 0, revenue: 0 };
    }
    salesMap[dateKey].orderCount += 1;
    salesMap[dateKey].revenue += Number(order.total);
  }

  return Object.values(salesMap).map((entry) => ({
    ...entry,
    revenue: parseFloat(entry.revenue.toFixed(2)),
  }));
};

exports.getCustomerGrowth = async ({ startDate, endDate }) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const where = {
    createdAt: {
      gte: startDate ? new Date(startDate) : thirtyDaysAgo,
      ...(endDate ? { lte: new Date(endDate) } : {}),
    },
  };

  const customers = await prisma.customer.findMany({
    where,
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const customerMap = {};
  for (const c of customers) {
    const dateKey = c.createdAt.toISOString().slice(0, 10);
    if (!customerMap[dateKey]) customerMap[dateKey] = 0;
    customerMap[dateKey]++;
  }

  return Object.entries(customerMap).map(([date, count]) => ({ date, customers: count }));
};

exports.getRecentOrders = async () => {
  return prisma.order.findMany({
    take: 10,
    include: { customer: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
};
