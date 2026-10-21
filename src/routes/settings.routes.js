const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/settings.controller");
const validate = require("../middlewares/validation.middleware");
const { settingsUpdateSchema, settingsBulkUpdateSchema } = require("../validations/common.validation");

router.get("/", controller.getAll);
router.put("/", authMiddleware, adminMiddleware, validate(settingsBulkUpdateSchema), controller.upsertAll);
router.get("/:key", controller.getByKey);
router.put("/:key", authMiddleware, adminMiddleware, validate(settingsUpdateSchema), controller.upsert);
router.delete("/:key", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
