const Joi = require("joi");

const createProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().allow("", null),
  price: Joi.number().positive().required(),
  stock: Joi.number().integer().min(0).required(),
  categoryId: Joi.string().required(),
  sku: Joi.string().allow("", null),
});

const updateProductSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  description: Joi.string().allow("", null),
  price: Joi.number().positive(),
  stock: Joi.number().integer().min(0),
  categoryId: Joi.string(),
  sku: Joi.string().allow("", null),
});

module.exports = { createProductSchema, updateProductSchema };
