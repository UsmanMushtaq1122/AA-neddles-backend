const Joi = require("joi");

const createReviewSchema = Joi.object({
  productId: Joi.string().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().max(100).allow("", null),
  comment: Joi.string().max(2000).required(),
});

const updateReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5),
  title: Joi.string().max(100).allow("", null),
  comment: Joi.string().max(2000),
}).min(1);

module.exports = { createReviewSchema, updateReviewSchema };
