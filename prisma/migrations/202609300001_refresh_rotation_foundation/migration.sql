-- Phase 2 persistence only. Existing auth flow does not populate these fields yet.
-- Preserve all historical rows; stop for review if legacy successors are shared.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (
    SELECT "replacedById" FROM "RefreshToken"
    WHERE "replacedById" IS NOT NULL
    GROUP BY "replacedById" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Shared legacy refresh successors require review before migration';
  END IF;
END;
$$;

ALTER TABLE "RefreshToken" ADD COLUMN "consumedAt" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "RefreshToken_replacedById_key" ON "RefreshToken"("replacedById");

-- Historical dangling identifiers remain visible for review, never rewritten.
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_fkey"
FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID;

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_consumed_check" CHECK (
  "consumedAt" IS NULL OR (
    "replacedById" IS NOT NULL AND "replacedById" <> "id"
    AND "revokedAt" IS NOT NULL
    AND "consumedAt" >= ("createdAt" AT TIME ZONE 'UTC')
  )
);

-- This relation only records a rotation. Same-user checks, one-time consumption,
-- locking and replay handling belong to the later transactional auth adapter.
-- Existing User.tokenVersion remains the account-wide revocation mechanism.
COMMIT;
