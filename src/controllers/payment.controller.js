const paymentService = require("../services/payment.service");

exports.createPayment = async (req, res, next) => {
  try {
    const result = await paymentService.createPayment({ ...req.body, customerId: req.user.customerId });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const result = await paymentService.verifyPayment(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentByOrder = async (req, res, next) => {
  try {
    const result = await paymentService.getPaymentByOrder(req.params.orderId, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getAllPayments = async (req, res, next) => {
  try {
    const result = await paymentService.getAllPayments(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.refundPayment = async (req, res, next) => {
  try {
    const result = await paymentService.refundPayment(req.params.id, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

