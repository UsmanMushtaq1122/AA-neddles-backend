-- Preserve the fabric value entered in the admin product form.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fabric" TEXT;
