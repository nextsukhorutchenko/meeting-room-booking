-- Preserve previously delivered rows as acknowledged while separating
-- temporary delivery leases for all future claims.
ALTER TABLE "Notification"
RENAME COLUMN "deliveredAt" TO "acknowledgedAt";

ALTER TABLE "Notification"
ADD COLUMN "leaseExpiresAt" TIMESTAMPTZ(3);

DROP INDEX "Notification_recipientId_deliveredAt_deliverAt_idx";

CREATE INDEX "Notification_recipientId_acknowledgedAt_leaseExpiresAt_deliverAt_idx"
ON "Notification"(
  "recipientId",
  "acknowledgedAt",
  "leaseExpiresAt",
  "deliverAt"
);
