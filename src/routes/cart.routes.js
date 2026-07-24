const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cart.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/", authMiddleware, cartController.getCart);
router.post("/items", authMiddleware, cartController.addToCart);
router.put("/items/:itemId", authMiddleware, cartController.updateCartItem);
router.delete("/items/:itemId", authMiddleware, cartController.removeFromCart);
router.delete("/", authMiddleware, cartController.clearCart);

module.exports = router;
