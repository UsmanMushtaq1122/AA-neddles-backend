const Joi = require("joi");

const createCouponSchema = Joi.object({
  code: Joi.string().alphanum().uppercase().required(),
  value: Joi.number().positive().required(),
  discount: Joi.number().positive(),
  type: Joi.string().valid("PERCENTAGE", "FIXED").required(),
  minOrderAmount: Joi.number().positive().allow(null),
  maxDiscount: Joi.number().positive().allow(null),
  usageLimit: Joi.number().integer().positive().allow(null),
  expiresAt: Joi.date().allow(null),
  isActive: Joi.boolean().default(true),
});

const updateCouponSchema = Joi.object({
  code: Joi.string().alphanum().uppercase(),
  value: Joi.number().positive(),
  discount: Joi.number().positive(),
  minOrderAmount: Joi.number().positive().allow(null),
  maxDiscount: Joi.number().positive().allow(null),
  usageLimit: Joi.number().integer().positive().allow(null),
  expiresAt: Joi.date().allow(null),
  isActive: Joi.boolean(),
}).min(1);

module.exports = { createCouponSchema, updateCouponSchema };
