const prisma = require("../config/db");
const AppError = require("../utils/AppError");

exports.getCart = async (customerId) => {
  let cart = await prisma.cart.findUnique({
    where: { customerId },
    include: {
      items: {
        include: { product: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { customerId },
      include: { items: true },
    });
  }

  const total = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return { ...cart, total: parseFloat(total.toFixed(2)) };
};

exports.addToCart = async (customerId, { productId, quantity, selectedSize = "" }) => {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError("Product not found", 404);

    const availableSizes = Array.isArray(product.sizes) ? product.sizes : [];
    if (availableSizes.length > 1 && !selectedSize) {
      throw new AppError("Please select a size before adding this product to your cart", 400);
    }
    if (selectedSize && availableSizes.length > 0 && !availableSizes.includes(selectedSize)) {
      throw new AppError("Selected size is not available for this product", 400);
    }

    if (product.stock < quantity) {
      throw new AppError(`Insufficient stock. Available: ${product.stock}`, 400);
    }

    let cart = await tx.cart.findUnique({ where: { customerId } });
    if (!cart) {
      cart = await tx.cart.create({ data: { customerId } });
    }

    const existingItem = await tx.cartItem.findFirst({
      where: { cartId: cart.id, productId, selectedSize },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > product.stock) {
        throw new AppError(`Cannot add more. Stock available: ${product.stock}, in cart: ${existingItem.quantity}`, 400);
      }
      await tx.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await tx.cartItem.create({
        data: { cartId: cart.id, productId, quantity, selectedSize },
      });
    }

    return exports.getCart(customerId);
  });
};

exports.updateCartItem = async (customerId, itemId, quantity) => {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({ where: { customerId } });
    if (!cart) throw new AppError("Cart not found", 404);

    const item = await tx.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new AppError("Cart item not found", 404);

    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (quantity > product.stock) {
      throw new AppError(`Insufficient stock. Available: ${product.stock}`, 400);
    }

    if (quantity <= 0) {
      await tx.cartItem.delete({ where: { id: itemId } });
    } else {
      await tx.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }

    return exports.getCart(customerId);
  });
};

exports.removeFromCart = async (customerId, itemId) => {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({ where: { customerId } });
    if (!cart) throw new AppError("Cart not found", 404);

    const item = await tx.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new AppError("Cart item not found", 404);

    await tx.cartItem.delete({ where: { id: itemId } });
    return exports.getCart(customerId);
  });
};

exports.clearCart = async (customerId) => {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({ where: { customerId } });
    if (!cart) throw new AppError("Cart not found", 404);

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return exports.getCart(customerId);
  });
};
