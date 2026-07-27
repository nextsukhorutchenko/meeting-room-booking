-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_END_HANDOFF');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "currentBookingId" TEXT NOT NULL,
    "nextBookingId" TEXT NOT NULL,
    "deliverAt" TIMESTAMPTZ(3) NOT NULL,
    "deliveredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_type_recipientId_currentBookingId_nextBookingId_key"
ON "Notification"("type", "recipientId", "currentBookingId", "nextBookingId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_deliveredAt_deliverAt_idx"
ON "Notification"("recipientId", "deliveredAt", "deliverAt");

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_currentBookingId_fkey"
FOREIGN KEY ("currentBookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_nextBookingId_fkey"
FOREIGN KEY ("nextBookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
