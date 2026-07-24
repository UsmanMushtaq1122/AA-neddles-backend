const cartService = require("../services/cart.service");

exports.getCart = async (req, res, next) => {
  try {
    const result = await cartService.getCart(req.user.customerId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.addToCart = async (req, res, next) => {
  try {
    const result = await cartService.addToCart(req.user.customerId, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateCartItem = async (req, res, next) => {
  try {
    const result = await cartService.updateCartItem(req.user.customerId, req.params.itemId, req.body.quantity);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.removeFromCart = async (req, res, next) => {
  try {
    const result = await cartService.removeFromCart(req.user.customerId, req.params.itemId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    const result = await cartService.clearCart(req.user.customerId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
