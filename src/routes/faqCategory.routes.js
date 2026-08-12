const express = require('express');
const router = express.Router();
const controller = require('../controllers/faqCategory.controller');
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const validate = require("../middlewares/validation.middleware");
const { faqCategorySchema, faqCategoryUpdateSchema } = require("../validations/common.validation");

router.get('/', controller.active);
router.get('/admin', authMiddleware, adminMiddleware, controller.list);
router.post('/', authMiddleware, adminMiddleware, validate(faqCategorySchema), controller.create);
router.put('/:id', authMiddleware, adminMiddleware, validate(faqCategoryUpdateSchema), controller.update);
router.delete('/:id', authMiddleware, adminMiddleware, controller.remove);
router.post('/reorder', authMiddleware, adminMiddleware, controller.reorder);

module.exports = router;
