const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/location.controller");
const validate = require("../middlewares/validation.middleware");
const { locationSchema, locationUpdateSchema } = require("../validations/common.validation");

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authMiddleware, adminMiddleware, validate(locationSchema), controller.create);
router.put("/:id", authMiddleware, adminMiddleware, validate(locationUpdateSchema), controller.update);
router.patch("/:id", authMiddleware, adminMiddleware, validate(locationUpdateSchema), controller.update);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
