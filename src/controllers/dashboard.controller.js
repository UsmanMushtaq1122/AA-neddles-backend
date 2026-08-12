const dashboardService = require("../services/dashboard.service");

exports.getStats = async (req, res, next) => {
  try {
    const result = await dashboardService.getStats();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getSalesData = async (req, res, next) => {
  try {
    const result = await dashboardService.getSalesData(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getCustomerGrowth = async (req, res, next) => {
  try {
    const result = await dashboardService.getCustomerGrowth(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getRecentOrders = async (req, res, next) => {
  try {
    const result = await dashboardService.getRecentOrders();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
