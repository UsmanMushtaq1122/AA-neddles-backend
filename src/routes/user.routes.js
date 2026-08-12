const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/user.controller");
const validate = require("../middlewares/validation.middleware");
const { userSchema, userUpdateSchema } = require("../validations/common.validation");

router.get("/", authMiddleware, adminMiddleware, controller.getAll);
router.post("/", authMiddleware, adminMiddleware, validate(userSchema), controller.create);
router.put("/:id", authMiddleware, adminMiddleware, validate(userUpdateSchema), controller.update);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
