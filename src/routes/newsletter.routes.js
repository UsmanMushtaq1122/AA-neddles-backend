const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");
const controller = require("../controllers/newsletter.controller");
const validate = require("../middlewares/validation.middleware");
const { newsletterSchema, newsletterUpdateSchema } = require("../validations/common.validation");

// Public
router.get("/unsubscribe", controller.unsubscribe);
router.post("/", validate(newsletterSchema), controller.subscribe);

// Admin
router.get("/campaigns", authMiddleware, adminMiddleware, controller.listCampaigns);
router.post("/campaigns", authMiddleware, adminMiddleware, controller.createCampaign);
router.get("/campaigns/:id", authMiddleware, adminMiddleware, controller.getCampaign);
router.put("/campaigns/:id", authMiddleware, adminMiddleware, controller.updateCampaign);
router.patch("/campaigns/:id/schedule", authMiddleware, adminMiddleware, controller.scheduleCampaign);
router.post("/campaigns/:id/retry", authMiddleware, adminMiddleware, controller.retryCampaign);

router.get("/", authMiddleware, adminMiddleware, controller.getAll);
router.put("/:id", authMiddleware, adminMiddleware, validate(newsletterUpdateSchema), controller.update);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
