-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "rooms_status_last_activity_at_idx" ON "rooms"("status", "last_activity_at");
