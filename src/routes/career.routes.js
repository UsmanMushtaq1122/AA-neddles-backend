const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/career.controller");
const validate = require("../middlewares/validation.middleware");
const { careerSchema, careerUpdateSchema, jobApplicationSchema } = require("../validations/common.validation");

router.get("/", controller.getAll);
router.get("/applications", authMiddleware, adminMiddleware, controller.listApplications);
router.get("/:id", controller.getById);
router.post("/", authMiddleware, adminMiddleware, validate(careerSchema), controller.create);
router.post("/:id/apply", validate(jobApplicationSchema), controller.apply);
router.put("/:id", authMiddleware, adminMiddleware, validate(careerUpdateSchema), controller.update);
router.patch("/:id", authMiddleware, adminMiddleware, validate(careerUpdateSchema), controller.update);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
