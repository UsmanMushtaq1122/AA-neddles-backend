-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN "unsubscribedAt" TIMESTAMP(3),
ADD COLUMN "unsubscribeToken" TEXT;

-- Backfill unsubscribe tokens for existing subscribers
UPDATE "NewsletterSubscriber"
SET "unsubscribeToken" = md5(random()::text || clock_timestamp()::text || id)
WHERE "unsubscribeToken" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_unsubscribeToken_key" ON "NewsletterSubscriber"("unsubscribeToken");

-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('DRAFT', 'PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Newsletter" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "status" "NewsletterStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Newsletter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Newsletter_status_idx" ON "Newsletter"("status");

-- CreateIndex
CREATE INDEX "Newsletter_status_scheduledAt_idx" ON "Newsletter"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Newsletter_createdAt_idx" ON "Newsletter"("createdAt");

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "NewsletterSend" (
    "id" TEXT NOT NULL,
    "newsletterId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "status" "SendStatus" NOT NULL,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSend_newsletterId_subscriberId_key" ON "NewsletterSend"("newsletterId", "subscriberId");

-- CreateIndex
CREATE INDEX "NewsletterSend_newsletterId_status_idx" ON "NewsletterSend"("newsletterId", "status");

-- CreateIndex
CREATE INDEX "NewsletterSend_subscriberId_idx" ON "NewsletterSend"("subscriberId");

-- AddForeignKey
ALTER TABLE "NewsletterSend" ADD CONSTRAINT "NewsletterSend_newsletterId_fkey" FOREIGN KEY ("newsletterId") REFERENCES "Newsletter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSend" ADD CONSTRAINT "NewsletterSend_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "NewsletterSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
