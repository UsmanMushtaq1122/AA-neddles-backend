const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/faq.controller");
const validate = require("../middlewares/validation.middleware");
const { faqSchema, faqUpdateSchema } = require("../validations/common.validation");

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authMiddleware, adminMiddleware, validate(faqSchema), controller.create);
router.put("/:id", authMiddleware, adminMiddleware, validate(faqUpdateSchema), controller.update);
router.patch("/:id", authMiddleware, adminMiddleware, validate(faqUpdateSchema), controller.patchStatus);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
