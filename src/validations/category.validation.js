const Joi = require("joi");

const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  slug: Joi.string().max(60).allow("", null),
  description: Joi.string().allow("", null),
  parentId: Joi.string().allow("", null),
  image: Joi.string().allow("", null),
  sortOrder: Joi.number().integer().min(0),
  isActive: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")).default(true),
  seoTitle: Joi.string().allow("", null),
  seoDescription: Joi.string().allow("", null),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(50),
  slug: Joi.string().max(60).allow("", null),
  description: Joi.string().allow("", null),
  parentId: Joi.string().allow("", null),
  image: Joi.string().allow("", null),
  sortOrder: Joi.number().integer().min(0),
  isActive: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")),
  seoTitle: Joi.string().allow("", null),
  seoDescription: Joi.string().allow("", null),
}).min(1);

module.exports = { createCategorySchema, updateCategorySchema };
