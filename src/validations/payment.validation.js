const Joi = require("joi");

const createPaymentSchema = Joi.object({
  orderId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  method: Joi.string().required(),
  transactionId: Joi.string().allow("", null),
});

const verifyPaymentSchema = Joi.object({
  paymentId: Joi.string().required(),
  transactionId: Joi.string().required(),
});

const refundPaymentSchema = Joi.object({
  amount: Joi.number().positive(),
  reason: Joi.string().max(500),
});

module.exports = { createPaymentSchema, verifyPaymentSchema, refundPaymentSchema };
