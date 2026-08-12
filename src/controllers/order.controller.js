const orderService = require("../services/order.service");

exports.getAllOrders = async (req, res, next) => {
  try {
    const result = await orderService.getAllOrders(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const result = await orderService.getOrdersByCustomer(req.user.customerId, req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const result = await orderService.getOrderById(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const result = await orderService.createOrder(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const result = await orderService.updateOrderStatus(req.params.id, req.body.status);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderNotes = async (req, res, next) => {
  try {
    const result = await orderService.updateOrderNotes(req.params.id, req.body.notes);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderTracking = async (req, res, next) => {
  try {
    const result = await orderService.updateOrderTracking(req.params.id, req.body.trackingNumber);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.trackOrder = async (req, res, next) => {
  try {
    const result = await orderService.trackOrder(req.params.orderNumber);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const result = await orderService.deleteOrder(req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
