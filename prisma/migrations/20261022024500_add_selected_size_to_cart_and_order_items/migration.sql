ALTER TABLE "CartItem" ADD COLUMN "selectedSize" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrderItem" ADD COLUMN "selectedSize" TEXT;

DROP INDEX "CartItem_cartId_productId_key";
CREATE UNIQUE INDEX "CartItem_cartId_productId_selectedSize_key"
  ON "CartItem"("cartId", "productId", "selectedSize");
