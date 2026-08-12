const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/editorial.controller");
const validate = require("../middlewares/validation.middleware");
const { editorialSchema, editorialUpdateSchema } = require("../validations/common.validation");

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authMiddleware, adminMiddleware, validate(editorialSchema), controller.create);
router.put("/:id", authMiddleware, adminMiddleware, validate(editorialUpdateSchema), controller.update);
router.patch("/:id", authMiddleware, adminMiddleware, validate(editorialUpdateSchema), controller.patchStatus);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
