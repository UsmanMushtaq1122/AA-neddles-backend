const Joi = require("joi");

const createSchema = (fields) => Joi.object(fields);

const updateSchema = (fields) => Joi.object(fields).min(1);

const stringField = (opts = {}) => Joi.string().max(opts.max || 500).allow("", null);
const requiredString = (opts = {}) => Joi.string().max(opts.max || 500).required();
const booleanField = () => Joi.boolean();
const numberField = () => Joi.number();
const positiveNumber = () => Joi.number().positive();

const bannerSchema = Joi.object({
  title: Joi.string().max(200).required(),
  subtitle: Joi.string().max(300).allow("", null),
  image: Joi.string().max(1000).allow("", null),
  imageUrl: Joi.string().max(1000).allow("", null),
  link: Joi.string().max(500).allow("", null),
  buttonText: Joi.string().max(100).allow("", null),
  type: Joi.string().valid("hero", "editorial", "announcement", "promo", "sidebar").default("hero"),
  isActive: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")).default(true),
  sortOrder: Joi.number().integer().min(0),
  bgColor: Joi.string().max(50).allow("", null),
  textColor: Joi.string().max(50).allow("", null),
  text: Joi.string().max(500).allow("", null),
});

const bannerUpdateSchema = Joi.object({
  title: Joi.string().max(200),
  subtitle: Joi.string().max(300).allow("", null),
  image: Joi.string().max(1000).allow("", null),
  imageUrl: Joi.string().max(1000).allow("", null),
  link: Joi.string().max(500).allow("", null),
  buttonText: Joi.string().max(100).allow("", null),
  type: Joi.string().valid("hero", "editorial", "announcement", "promo", "sidebar"),
  isActive: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")),
  sortOrder: Joi.number().integer().min(0),
  bgColor: Joi.string().max(50).allow("", null),
  textColor: Joi.string().max(50).allow("", null),
  text: Joi.string().max(500).allow("", null),
}).min(1);

const contactSchema = Joi.object({
  name: Joi.string().max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(20).allow("", null),
  subject: Joi.string().max(200).required(),
  message: Joi.string().max(5000).required(),
});

const contactUpdateSchema = Joi.object({
  status: Joi.string().valid("new", "read", "replied", "closed"),
  notes: Joi.string().max(2000).allow("", null),
}).min(1);

const newsletterSchema = Joi.object({
  email: Joi.string().email().required(),
});

const newsletterUpdateSchema = Joi.object({
  isActive: Joi.boolean(),
}).min(1);

const faqSchema = Joi.object({
  question: Joi.string().max(500).required(),
  answer: Joi.string().max(5000).required(),
  category: Joi.string().max(50).allow("", null),
  sortOrder: Joi.number().integer().min(0),
});

const faqUpdateSchema = Joi.object({
  question: Joi.string().max(500),
  answer: Joi.string().max(5000),
  category: Joi.string().max(50).allow("", null),
  sortOrder: Joi.number().integer().min(0),
}).min(1);

const testimonialSchema = Joi.object({
  customerName: Joi.string().max(100).required(),
  content: Joi.string().max(2000).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  type: Joi.string().valid("gallery", "video", "instagram", "story").default("gallery"),
  videoUrl: Joi.string().uri().allow("", null),
  sortOrder: Joi.number().integer().min(0),
  image: Joi.string().uri().allow("", null),
  isActive: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")).default(true),
});

const testimonialUpdateSchema = Joi.object({
  customerName: Joi.string().max(100),
  content: Joi.string().max(2000),
  rating: Joi.number().integer().min(1).max(5),
  type: Joi.string().valid("gallery", "video", "instagram", "story"),
  videoUrl: Joi.string().uri().allow("", null),
  sortOrder: Joi.number().integer().min(0),
  image: Joi.string().uri().allow("", null),
  isActive: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")),
}).min(1);

const locationSchema = Joi.object({
  name: Joi.string().max(100).required(),
  address: Joi.string().max(500).required(),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100).required(),
  zip: Joi.string().max(20).allow("", null),
  phone: Joi.string().max(20).allow("", null),
  hours: Joi.string().max(500).allow("", null),
  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
  isActive: Joi.boolean().default(true),
});

const locationUpdateSchema = Joi.object({
  name: Joi.string().max(100),
  address: Joi.string().max(500),
  city: Joi.string().max(100),
  state: Joi.string().max(100),
  zip: Joi.string().max(20).allow("", null),
  phone: Joi.string().max(20).allow("", null),
  hours: Joi.string().max(500).allow("", null),
  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
  isActive: Joi.boolean(),
}).min(1);

const careerSchema = Joi.object({
  title: Joi.string().max(200).required(),
  department: Joi.string().max(100).required(),
  location: Joi.string().max(200).required(),
  type: Joi.string().valid("full-time", "part-time", "contract", "internship").required(),
  description: Joi.string().max(10000).required(),
  requirements: Joi.alternatives().try(
    Joi.string().max(5000).allow("", null),
    Joi.array().items(Joi.string().max(1000)).max(100)
  ).allow("", null),
  salaryRange: Joi.string().max(100).allow("", null),
  salary: Joi.string().max(100).allow("", null),
  isActive: Joi.boolean().default(true),
  active: Joi.boolean(),
});

const careerUpdateSchema = Joi.object({
  title: Joi.string().max(200),
  department: Joi.string().max(100),
  location: Joi.string().max(200),
  type: Joi.string().valid("full-time", "part-time", "contract", "internship"),
  description: Joi.string().max(10000),
  requirements: Joi.alternatives().try(
    Joi.string().max(5000).allow("", null),
    Joi.array().items(Joi.string().max(1000)).max(100)
  ).allow("", null),
  salaryRange: Joi.string().max(100).allow("", null),
  salary: Joi.string().max(100).allow("", null),
  isActive: Joi.boolean(),
  active: Joi.boolean(),
}).min(1);

const jobApplicationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().max(200).required(),
  phone: Joi.string().max(20).allow("", null),
  portfolio: Joi.string().max(500).allow("", null),
  message: Joi.string().max(5000).allow("", null),
});

const userSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid("SUPER_ADMIN", "ADMIN"),
  isActive: Joi.boolean().default(true),
});

const userUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(50),
  email: Joi.string().email(),
  password: Joi.string().min(8).max(128),
  role: Joi.string().valid("SUPER_ADMIN", "ADMIN"),
  isActive: Joi.boolean(),
}).min(1);

const customerUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(50),
  email: Joi.string().email(),
  phone: Joi.string().max(20).allow("", null),
  isActive: Joi.boolean(),
}).min(1);

const settingsUpdateSchema = Joi.object({
  value: Joi.any().required(),
});

const settingsBulkUpdateSchema = Joi.object().min(1).unknown(true);

const orderStatusSchema = Joi.object({
  status: Joi.string().valid("PENDING", "CONFIRMED", "PROCESSING", "QUALITY_CHECK", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED").required(),
  notes: Joi.string().max(2000).allow("", null),
  cancellationReason: Joi.string().max(1000).allow("", null),
  carrier: Joi.string().max(100).allow("", null),
  trackingNumber: Joi.string().max(100).allow("", null),
  trackingUrl: Joi.string().uri().allow("", null),
  deliveryInstructions: Joi.string().max(1000).allow("", null),
});

const orderNotesSchema = Joi.object({
  notes: Joi.string().max(2000).required(),
});

const orderTrackingSchema = Joi.object({
  carrier: Joi.string().max(100).allow("", null),
  trackingNumber: Joi.string().max(100).required(),
  url: Joi.string().uri().allow("", null),
  trackingUrl: Joi.string().uri().allow("", null),
});

const editorialSchema = Joi.object({
  title: Joi.string().max(200).required(),
  subtitle: Joi.string().max(300).allow("", null),
  description: Joi.string().max(5000).allow("", null),
  imageUrl: Joi.string().max(500).allow("", null),
  link: Joi.string().max(500).allow("", null),
  category: Joi.string().max(100).allow("", null),
  isActive: Joi.boolean().default(true),
  sortOrder: Joi.number().integer().min(0),
});

const editorialUpdateSchema = Joi.object({
  title: Joi.string().max(200),
  subtitle: Joi.string().max(300).allow("", null),
  description: Joi.string().max(5000).allow("", null),
  imageUrl: Joi.string().max(500).allow("", null),
  link: Joi.string().max(500).allow("", null),
  category: Joi.string().max(100).allow("", null),
  isActive: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0),
}).min(1);

const cmsPageSchema = Joi.object({
  title: Joi.string().max(200).required(),
  slug: Joi.string().max(200).regex(/^[a-z0-9-]+$/).allow("", null),
  content: Joi.string().max(50000).allow("", null),
  published: Joi.boolean().default(false),
  metaTitle: Joi.string().max(100).allow("", null),
  metaDescription: Joi.string().max(300).allow("", null),
});

const cmsPageUpdateSchema = Joi.object({
  title: Joi.string().max(200),
  slug: Joi.string().max(200).regex(/^[a-z0-9-]+$/),
  content: Joi.string().max(50000).allow("", null),
  published: Joi.boolean(),
  metaTitle: Joi.string().max(100).allow("", null),
  metaDescription: Joi.string().max(300).allow("", null),
}).min(1);

const faqCategorySchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  isActive: Joi.boolean().default(true),
  sortOrder: Joi.number().integer().min(0),
});

const faqCategoryUpdateSchema = Joi.object({
  name: Joi.string().trim().max(100),
  isActive: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0),
}).min(1);

module.exports = {
  createSchema, updateSchema, stringField, requiredString, booleanField, numberField, positiveNumber,
  bannerSchema, bannerUpdateSchema,
  contactSchema, contactUpdateSchema,
  newsletterSchema, newsletterUpdateSchema,
  faqSchema, faqUpdateSchema,
  faqCategorySchema, faqCategoryUpdateSchema,
  testimonialSchema, testimonialUpdateSchema,
  locationSchema, locationUpdateSchema,
  careerSchema, careerUpdateSchema, jobApplicationSchema,
  userSchema, userUpdateSchema,
  customerUpdateSchema,
  settingsUpdateSchema, settingsBulkUpdateSchema,
  orderStatusSchema, orderNotesSchema, orderTrackingSchema,
  editorialSchema, editorialUpdateSchema,
  cmsPageSchema, cmsPageUpdateSchema,
};
