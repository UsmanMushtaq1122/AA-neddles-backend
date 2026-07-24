const Joi = require("joi");

const createCouponSchema = Joi.object({
  code: Joi.string().alphanum().uppercase().required(),
  discount: Joi.number().positive().required(),
  type: Joi.string().valid("PERCENTAGE", "FIXED").required(),
  minOrderAmount: Joi.number().positive().allow(null),
  maxDiscount: Joi.number().positive().allow(null),
  expiresAt: Joi.date().greater("now").required(),
  isActive: Joi.boolean().default(true),
});

const updateCouponSchema = Joi.object({
  discount: Joi.number().positive(),
  minOrderAmount: Joi.number().positive().allow(null),
  maxDiscount: Joi.number().positive().allow(null),
  expiresAt: Joi.date().greater("now"),
  isActive: Joi.boolean(),
}).min(1);

module.exports = { createCouponSchema, updateCouponSchema };
