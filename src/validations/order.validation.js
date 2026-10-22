const Joi = require("joi");

const createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().positive().required(),
        price: Joi.number().positive().required(),
        selectedSize: Joi.string().trim().max(100).allow("").optional(),
      })
    )
    .min(1)
    .required(),
  shippingAddress: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    addressLine1: Joi.string().required(),
    addressLine2: Joi.string().allow(""),
    city: Joi.string().required(),
    province: Joi.string().required(),
    country: Joi.string().required(),
    postalCode: Joi.string().allow(""),
  }).required(),
  paymentMethod: Joi.string().required(),
  deliveryMethod: Joi.string().valid("standard", "express").optional(),
  couponCode: Joi.string().allow("", null),
  mobileNumber: Joi.string().allow("", null),
  cardLast4: Joi.string().allow("", null),
});

module.exports = { createOrderSchema };
