const Joi = require("joi");

const REQUIRED_FIELD = "Please fill in all required fields.";

const nameField = Joi.string().trim().min(2).max(100).required().messages({
  "string.empty": "Product name is required.",
  "any.required": "Product name is required.",
  "string.min": "Product name must be at least 2 characters.",
  "string.max": "Product name must be at most 100 characters.",
});

const priceField = Joi.number().positive().messages({
  "number.base": "Invalid price value entered.",
  "number.positive": "Price must be greater than 0.",
  "any.required": REQUIRED_FIELD,
});

const optionalPriceField = Joi.number().positive().allow(null).messages({
  "number.base": "Invalid price value entered.",
  "number.positive": "Price must be greater than 0.",
});

const stockField = Joi.number().integer().min(0).messages({
  "number.base": "Invalid stock value entered.",
  "number.integer": "Invalid stock value entered.",
  "number.min": "Stock cannot be negative.",
  "any.required": REQUIRED_FIELD,
});

const categoryIdField = Joi.string().required().messages({
  "string.empty": "Please select a category.",
  "any.required": "Please select a category.",
});

const stringField = Joi.string().allow("", null);

const createProductSchema = Joi.object({
  name: nameField,
  description: stringField,
  shortDescription: stringField,
  price: priceField.required(),
  compareAtPrice: optionalPriceField,
  costPrice: optionalPriceField,
  stock: stockField.required(),
  lowStockThreshold: Joi.number().integer().min(0).messages({
    "number.base": "Invalid low stock threshold value entered.",
  }),
  categoryId: categoryIdField,
  sku: Joi.string().allow("", null).messages({
    "string.empty": "SKU is required.",
  }),
  barcode: Joi.string().allow("", null),
  weight: Joi.number().allow(null).messages({
    "number.base": "Invalid weight value entered.",
  }),
  status: Joi.string().valid("ACTIVE", "DRAFT", "ARCHIVED", "active", "draft", "archived"),
  isFeatured: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")),
  isNewArrival: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")),
  isBestSeller: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")),
  images: Joi.any(),
  tags: Joi.any(),
  seoTitle: stringField,
  seoDescription: stringField,
});

const updateProductSchema = Joi.object({
  name: nameField,
  description: stringField,
  shortDescription: stringField,
  price: priceField,
  compareAtPrice: optionalPriceField,
  costPrice: optionalPriceField,
  stock: stockField,
  lowStockThreshold: Joi.number().integer().min(0).messages({
    "number.base": "Invalid low stock threshold value entered.",
  }),
  categoryId: Joi.string().messages({
    "string.empty": "Please select a category.",
  }),
  sku: Joi.string().allow("", null).messages({
    "string.empty": "SKU is required.",
  }),
  barcode: Joi.string().allow("", null),
  weight: Joi.number().allow(null).messages({
    "number.base": "Invalid weight value entered.",
  }),
  status: Joi.string().valid("ACTIVE", "DRAFT", "ARCHIVED", "active", "draft", "archived"),
  isFeatured: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")),
  isNewArrival: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")),
  isBestSeller: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")),
  images: Joi.any(),
  tags: Joi.any(),
  seoTitle: stringField,
  seoDescription: stringField,
}).min(1);

const checkDuplicatesSchema = Joi.object({
  name: Joi.string().trim().allow("", null),
  sku: Joi.string().trim().allow("", null),
  slug: Joi.string().trim().allow("", null),
  excludeId: Joi.string().trim().allow("", null),
});

module.exports = { createProductSchema, updateProductSchema, checkDuplicatesSchema };
