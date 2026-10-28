CREATE TABLE IF NOT EXISTS "EditorialContent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "link" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialContent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EditorialContent_isActive_idx" ON "EditorialContent"("isActive");
CREATE INDEX IF NOT EXISTS "EditorialContent_sortOrder_idx" ON "EditorialContent"("sortOrder");
CREATE INDEX IF NOT EXISTS "EditorialContent_category_idx" ON "EditorialContent"("category");
CREATE INDEX IF NOT EXISTS "EditorialContent_isActive_sortOrder_idx" ON "EditorialContent"("isActive", "sortOrder");
