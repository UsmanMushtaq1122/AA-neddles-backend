const Joi = require("joi");

const createOrderSchema = Joi.object({
  customerId: Joi.string().required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().positive().required(),
        price: Joi.number().positive().required(),
      })
    )
    .min(1)
    .required(),
  shippingAddress: Joi.string().required(),
  paymentMethod: Joi.string().required(),
  couponCode: Joi.string().allow("", null),
});

module.exports = { createOrderSchema };
