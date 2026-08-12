const Joi = require("joi");

const addCartItemSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().integer().positive().required(),
});

const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().positive().required(),
});

module.exports = { addCartItemSchema, updateCartItemSchema };
