const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/contact.controller");
const validate = require("../middlewares/validation.middleware");
const { contactSchema, contactUpdateSchema } = require("../validations/common.validation");

router.get("/", authMiddleware, adminMiddleware, controller.getAll);
router.get("/:id", authMiddleware, adminMiddleware, controller.getById);
router.post("/", validate(contactSchema), controller.create);
router.put("/:id", authMiddleware, adminMiddleware, validate(contactUpdateSchema), controller.update);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
