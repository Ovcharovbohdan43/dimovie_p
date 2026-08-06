-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "scheduled_starts_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "rooms_privacy_status_scheduled_starts_at_idx" ON "rooms"("privacy", "status", "scheduled_starts_at");
