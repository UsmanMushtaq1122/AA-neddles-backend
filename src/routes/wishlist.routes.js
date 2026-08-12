const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/wishlist.controller");
const validate = require("../middlewares/validation.middleware");
const { toggleWishlistSchema } = require("../validations/wishlist.validation");

router.get("/", authMiddleware, controller.getMyWishlist);
router.post("/", authMiddleware, validate(toggleWishlistSchema), controller.toggle);
router.delete("/:productId", authMiddleware, controller.remove);

module.exports = router;
