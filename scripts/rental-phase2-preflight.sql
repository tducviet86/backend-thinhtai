-- Read-only, aggregate-only review. Works before or after the Phase 2 migrations.
-- No contact details, tokens, payloads or provider secrets are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT 'booking_commercial_terms' AS review, "status", "currency",
       count(*) AS rows,
       count(*) FILTER (WHERE "depositRequired" = "total" * 0.30) AS thirty_percent_deposits,
       count(*) FILTER (WHERE "total" <> trunc("total") OR "paidAmount" <> trunc("paidAmount")) AS fractional_amounts,
       count(*) FILTER (WHERE "paidAmount" > "total" OR "remainingAmount" <> "total" - "paidAmount") AS accounting_mismatches
FROM "Booking" GROUP BY "status", "currency" ORDER BY "status", "currency";

-- to_jsonb permits inspecting nullable additions even before columns exist.
SELECT 'booking_policy_classification' AS review,
       count(*) FILTER (WHERE to_jsonb(b)->>'paymentOption' IS NULL) AS legacy_rows,
       count(*) FILTER (WHERE to_jsonb(b)->>'paymentOption' IS NOT NULL) AS new_policy_rows
FROM "Booking" b;

SELECT 'hold_review' AS review,
       count(*) FILTER (WHERE h."status" = 'ACTIVE' AND h."expiresAt" > CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                       AND to_jsonb(h)->>'tokenHash' IS NULL) AS active_tokenless_holds,
       count(*) FILTER (WHERE h."bookingDraftId" IS NOT NULL AND b."id" IS NULL) AS dangling_booking_links
FROM "Hold" h LEFT JOIN "Booking" b ON b."id" = h."bookingDraftId";

SELECT 'payment_evidence' AS review, "provider", "status", count(*) AS rows,
       count(*) FILTER (WHERE "providerReference" IS NULL) AS missing_reference,
       count(*) FILTER (WHERE to_jsonb(p)->>'merchantId' IS NULL) AS missing_merchant,
       count(*) FILTER (WHERE "paidAt" IS NULL AND "status" = 'PAID') AS paid_without_timestamp
FROM "Payment" p GROUP BY "provider", "status" ORDER BY "provider", "status";

SELECT 'multiple_live_vnpay_attempts' AS review, count(*) AS bookings
FROM (SELECT "bookingId" FROM "Payment" WHERE "provider" = 'VNPAY'
      AND "status" IN ('PENDING', 'PROCESSING') GROUP BY "bookingId" HAVING count(*) > 1) p;

SELECT 'identity_candidates_do_not_auto_merge' AS review,
       (SELECT count(*) FROM (SELECT lower(btrim("email")) FROM "Customer"
         WHERE nullif(btrim("email"), '') IS NOT NULL
         GROUP BY lower(btrim("email")) HAVING count(*) > 1) e) AS shared_email_groups,
       (SELECT count(*) FROM (SELECT "phone" FROM "Customer"
         WHERE nullif(btrim("phone"), '') IS NOT NULL
         GROUP BY "phone" HAVING count(*) > 1) p) AS shared_phone_groups,
       (SELECT count(*) FROM "Customer" WHERE "userId" IS NULL) AS unlinked_customers;

SELECT 'refresh_rotation_review' AS review,
       count(*) FILTER (WHERE t."replacedById" IS NOT NULL AND s."id" IS NULL) AS dangling_successors,
       count(*) FILTER (WHERE t."replacedById" = t."id") AS self_links,
       count(*) FILTER (WHERE s."userId" <> t."userId") AS cross_user_links,
       (SELECT count(*) FROM (SELECT "replacedById" FROM "RefreshToken"
        WHERE "replacedById" IS NOT NULL GROUP BY "replacedById" HAVING count(*) > 1) d) AS shared_successor_groups
FROM "RefreshToken" t LEFT JOIN "RefreshToken" s ON s."id" = t."replacedById";

SELECT 'sql_owned_constraints' AS review, conname, convalidated
FROM pg_constraint WHERE conrelid IN ('"Booking"'::regclass, '"Hold"'::regclass, '"RefreshToken"'::regclass)
ORDER BY conname;
COMMIT;
