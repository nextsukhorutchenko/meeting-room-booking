CREATE TABLE "AuthRateLimitBucket" (
  "key" VARCHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL,
  "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "AuthRateLimitBucket_expiresAt_idx"
ON "AuthRateLimitBucket"("expiresAt");
