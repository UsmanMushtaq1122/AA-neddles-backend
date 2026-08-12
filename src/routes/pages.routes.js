const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/pages.controller");
const validate = require("../middlewares/validation.middleware");
const { cmsPageSchema, cmsPageUpdateSchema } = require("../validations/common.validation");

router.get("/", controller.getAll);
router.get("/by-slug/:slug", controller.getBySlug);
router.get("/:id", controller.getById);
router.post("/", authMiddleware, adminMiddleware, validate(cmsPageSchema), controller.create);
router.put("/:id", authMiddleware, adminMiddleware, validate(cmsPageUpdateSchema), controller.update);
router.patch("/:id", authMiddleware, adminMiddleware, validate(cmsPageUpdateSchema), controller.patchStatus);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
