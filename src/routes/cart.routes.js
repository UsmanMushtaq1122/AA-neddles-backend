const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cart.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validation.middleware");
const { addCartItemSchema, updateCartItemSchema } = require("../validations/cart.validation");

router.get("/", authMiddleware, cartController.getCart);
router.post("/items", authMiddleware, validate(addCartItemSchema), cartController.addToCart);
router.put("/items/:itemId", authMiddleware, validate(updateCartItemSchema), cartController.updateCartItem);
router.delete("/items/:itemId", authMiddleware, cartController.removeFromCart);
router.delete("/", authMiddleware, cartController.clearCart);

module.exports = router;
