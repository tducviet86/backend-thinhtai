-- Generated with Prisma 6.19 schema-to-schema diff; reviewed additions follow.
-- PostgreSQL >= 12. This file is authored for review, NOT applied to project databases.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
CREATE TYPE "PaymentOption" AS ENUM ('DEPOSIT_50', 'FULL_100');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('INITIAL', 'BALANCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "CaptureDisposition" AS ENUM ('APPLIED', 'REFUND_REQUIRED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "CancellationCause" AS ENUM ('CUSTOMER_CANCELLATION', 'OPERATOR_CANCELLATION', 'BOOKING_EXPIRY');

-- CreateEnum
CREATE TYPE "CancellationActor" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('CUSTOMER_CANCELLATION', 'OPERATOR_CANCELLATION', 'BOOKING_EXPIRY', 'LATE_CAPTURE', 'SUPERSEDED_CAPTURE');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'PENDING_PROVIDER', 'SUCCEEDED', 'RETRYABLE_FAILED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "RefundAttemptStatus" AS ENUM ('PREPARED', 'SENT', 'PENDING', 'SUCCEEDED', 'DEFINITIVELY_FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'APPLIED', 'REFUND_SCHEDULED', 'FAILURE_RECORDED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'SUPERSEDED';
ALTER TYPE "PaymentStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "PriceQuote" ADD COLUMN     "holdId" UUID,
ADD COLUMN     "promotionId" UUID;

-- AlterTable
ALTER TABLE "Hold" ADD COLUMN     "clientKeyHash" VARCHAR(64),
ADD COLUMN     "convertedAt" TIMESTAMPTZ(3),
ADD COLUMN     "expiredAt" TIMESTAMPTZ(3),
ADD COLUMN     "releasedAt" TIMESTAMPTZ(3),
ADD COLUMN     "tokenHash" VARCHAR(64);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "checkInAt" TIMESTAMPTZ(3),
ADD COLUMN     "confirmationRequired" DECIMAL(12,2),
ADD COLUMN     "confirmedAt" TIMESTAMPTZ(3),
ADD COLUMN     "expiredAt" TIMESTAMPTZ(3),
ADD COLUMN     "paymentDueAt" TIMESTAMPTZ(3),
ADD COLUMN     "paymentOption" "PaymentOption",
ADD COLUMN     "policyVersion" TEXT,
ADD COLUMN     "pricingSnapshot" JSONB,
ADD COLUMN     "quoteId" UUID,
ADD COLUMN     "stayTimeZone" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "closedAt" TIMESTAMPTZ(3),
ADD COLUMN     "expiresAt" TIMESTAMPTZ(3),
ADD COLUMN     "leaseOwner" TEXT,
ADD COLUMN     "leaseUntil" TIMESTAMPTZ(3),
ADD COLUMN     "merchantId" TEXT,
ADD COLUMN     "nextReconcileAt" TIMESTAMPTZ(3),
ADD COLUMN     "providerCreateDate" VARCHAR(14),
ADD COLUMN     "providerRequest" JSONB,
ADD COLUMN     "purpose" "PaymentPurpose",
ADD COLUMN     "supersededAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "PaymentWebhookEvent" ADD COLUMN     "ackCode" VARCHAR(2),
ADD COLUMN     "eventFingerprint" VARCHAR(64),
ADD COLUMN     "merchantId" TEXT,
ADD COLUMN     "paymentId" UUID,
ADD COLUMN     "providerEvidence" JSONB,
ADD COLUMN     "status" "WebhookEventStatus";

-- CreateTable
CREATE TABLE "PaymentCapture" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "appliedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "disposition" "CaptureDisposition" NOT NULL,
    "capturedAt" TIMESTAMPTZ(3),
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerEvidence" JSONB,

    CONSTRAINT "PaymentCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingCancellation" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "cause" "CancellationCause" NOT NULL,
    "actorType" "CancellationActor" NOT NULL,
    "actorUserId" UUID,
    "reason" TEXT NOT NULL,
    "cancelledAt" TIMESTAMPTZ(3) NOT NULL,
    "checkInAt" TIMESTAMPTZ(3) NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "paidBasis" DECIMAL(12,2) NOT NULL,
    "refundPercent" INTEGER NOT NULL,
    "refundEntitlement" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "captureId" UUID NOT NULL,
    "cancellationId" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "nextAttemptAt" TIMESTAMPTZ(3),
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseOwner" TEXT,
    "lastErrorCode" TEXT,
    "lastError" TEXT,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundAttempt" (
    "id" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "providerRequestId" VARCHAR(32) NOT NULL,
    "providerRefundReference" TEXT,
    "status" "RefundAttemptStatus" NOT NULL DEFAULT 'PREPARED',
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),
    "processedAt" TIMESTAMPTZ(3),
    "errorCode" TEXT,

    CONSTRAINT "RefundAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(160) NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "resourceType" TEXT,
    "resourceId" UUID,
    "httpStatus" INTEGER,
    "responseCiphertext" BYTEA,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentCapture_paymentId_bookingId_idx" ON "PaymentCapture"("paymentId", "bookingId");

-- CreateIndex
CREATE INDEX "PaymentCapture_bookingId_recordedAt_idx" ON "PaymentCapture"("bookingId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCapture_provider_transaction_key" ON "PaymentCapture"("provider", "merchantId", "providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCapture_id_bookingId_key" ON "PaymentCapture"("id", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCancellation_bookingId_key" ON "BookingCancellation"("bookingId");

-- CreateIndex
CREATE INDEX "BookingCancellation_actorUserId_cancelledAt_idx" ON "BookingCancellation"("actorUserId", "cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCancellation_id_bookingId_key" ON "BookingCancellation"("id", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_bookingId_requestedAt_idx" ON "Refund"("bookingId", "requestedAt");

-- CreateIndex
CREATE INDEX "Refund_cancellationId_bookingId_idx" ON "Refund"("cancellationId", "bookingId");

-- CreateIndex
CREATE INDEX "Refund_status_nextAttemptAt_idx" ON "Refund"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_captureId_reason_key" ON "Refund"("captureId", "reason");

-- CreateIndex
CREATE INDEX "RefundAttempt_status_createdAt_idx" ON "RefundAttempt"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefundAttempt_refundId_sequence_key" ON "RefundAttempt"("refundId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RefundAttempt_provider_request_key" ON "RefundAttempt"("provider", "merchantId", "providerRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundAttempt_provider_refund_key" ON "RefundAttempt"("provider", "merchantId", "providerRefundReference");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_keyHash_key" ON "IdempotencyRecord"("scope", "keyHash");

-- CreateIndex
CREATE INDEX "PriceQuote_holdId_idx" ON "PriceQuote"("holdId");

-- CreateIndex
CREATE UNIQUE INDEX "Hold_tokenHash_key" ON "Hold"("tokenHash");

-- CreateIndex
CREATE INDEX "Hold_clientKeyHash_status_expiresAt_idx" ON "Hold"("clientKeyHash", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_quoteId_key" ON "Booking"("quoteId");

-- CreateIndex
CREATE INDEX "Booking_status_paymentDueAt_idx" ON "Booking"("status", "paymentDueAt");

-- CreateIndex
CREATE INDEX "Payment_status_nextReconcileAt_idx" ON "Payment"("status", "nextReconcileAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_bookingId_key" ON "Payment"("id", "bookingId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_paymentId_idx" ON "PaymentWebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_status_createdAt_idx" ON "PaymentWebhookEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_scoped_fingerprint_key" ON "PaymentWebhookEvent"("provider", "merchantId", "eventFingerprint");

-- AddForeignKey
ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "Hold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- Existing values have never had an FK. Enforce new writes without fabricating
-- or deleting historical references. Validate separately after read-only preflight.
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_bookingDraftId_fkey" FOREIGN KEY ("bookingDraftId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "PriceQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCapture" ADD CONSTRAINT "PaymentCapture_paymentId_bookingId_fkey" FOREIGN KEY ("paymentId", "bookingId") REFERENCES "Payment"("id", "bookingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCapture" ADD CONSTRAINT "PaymentCapture_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCancellation" ADD CONSTRAINT "BookingCancellation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCancellation" ADD CONSTRAINT "BookingCancellation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_captureId_bookingId_fkey" FOREIGN KEY ("captureId", "bookingId") REFERENCES "PaymentCapture"("id", "bookingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_cancellationId_bookingId_fkey" FOREIGN KEY ("cancellationId", "bookingId") REFERENCES "BookingCancellation"("id", "bookingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundAttempt" ADD CONSTRAINT "RefundAttempt_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial indexes and CHECK/trigger constraints are SQL-owned (Prisma 6 does not
-- express them). Existing attempts have NULL purpose and are not retroactively
-- classified or invalidated. Phase 5 must reconcile legacy live attempts first.
CREATE UNIQUE INDEX "Payment_one_live_vnpay_attempt_key"
ON "Payment" ("bookingId")
WHERE "purpose" IS NOT NULL AND "provider" = 'VNPAY'
  AND "status" IN ('PENDING', 'PROCESSING');

CREATE UNIQUE INDEX "PaymentCapture_one_applied_capture_key"
ON "PaymentCapture" ("paymentId") WHERE "appliedAmount" > 0;

CREATE UNIQUE INDEX "RefundAttempt_one_unresolved_execution_key"
ON "RefundAttempt" ("refundId")
WHERE "status" IN ('PREPARED', 'SENT', 'PENDING', 'UNKNOWN');

-- Opt-in validation for new-contract rows; all existing columns retain their
-- types, defaults and nullability. Legacy commercial values are not rounded.
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_token_contract_check" CHECK (
  "tokenHash" IS NULL OR (
    "tokenHash" ~ '^[0-9a-f]{64}$'
    AND "clientKeyHash" IS NOT NULL AND "clientKeyHash" ~ '^[0-9a-f]{64}$'
    AND "expiresAt" = "createdAt" + INTERVAL '15 minutes'
    AND ("status" <> 'CONVERTED' OR ("bookingDraftId" IS NOT NULL AND "convertedAt" IS NOT NULL))
    AND ("status" <> 'CANCELLED' OR "releasedAt" IS NOT NULL)
    AND ("status" <> 'EXPIRED' OR "expiredAt" IS NOT NULL)
  )
);

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_payment_contract_check" CHECK (
  "paymentOption" IS NULL OR (
    "confirmationRequired" IS NOT NULL AND "paymentDueAt" IS NOT NULL
    AND "checkInAt" IS NOT NULL AND "stayTimeZone" IS NOT NULL
    AND "policyVersion" IS NOT NULL
    AND length(btrim("stayTimeZone")) > 0 AND length(btrim("policyVersion")) > 0
    AND "currency" = 'VND'
    AND "total" BETWEEN 0 AND 9999999999 AND "total" = trunc("total")
    AND "subtotal" BETWEEN 0 AND 9999999999 AND "subtotal" = trunc("subtotal")
    AND "fees" BETWEEN 0 AND 9999999999 AND "fees" = trunc("fees")
    AND "discount" BETWEEN 0 AND 9999999999 AND "discount" = trunc("discount")
    AND "total" = "subtotal" + "fees" - "discount"
    AND "depositRequired" = floor("total" / 2)
    AND "confirmationRequired" = CASE WHEN "paymentOption" = 'DEPOSIT_50' THEN "depositRequired" ELSE "total" END
    AND "paidAmount" BETWEEN 0 AND "total" AND "paidAmount" = trunc("paidAmount")
    AND "remainingAmount" = "total" - "paidAmount"
    AND ("normalTotal" IS NULL OR ("normalTotal" BETWEEN 0 AND 9999999999 AND "normalTotal" = trunc("normalTotal")))
    AND "paymentDueAt" = ("createdAt" AT TIME ZONE 'UTC') + INTERVAL '30 minutes'
  )
);

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_attempt_contract_check" CHECK (
  "purpose" IS NULL OR (
    "currency" = 'VND' AND "amount" BETWEEN 1 AND 9999999999 AND "amount" = trunc("amount")
    AND "provider" IS NOT NULL AND length(btrim("provider")) > 0
    AND "merchantId" IS NOT NULL AND length(btrim("merchantId")) > 0
    AND "providerReference" IS NOT NULL AND length(btrim("providerReference")) > 0
    AND ("purpose" = 'MANUAL' OR "expiresAt" IS NOT NULL)
    AND ("provider" <> 'VNPAY' OR ("providerCreateDate" IS NOT NULL AND "providerCreateDate" ~ '^[0-9]{14}$'))
  )
);

ALTER TABLE "PaymentCapture" ADD CONSTRAINT "PaymentCapture_vnd_check" CHECK (
  "currency" = 'VND' AND "amount" BETWEEN 1 AND 9999999999 AND "amount" = trunc("amount")
  AND "appliedAmount" BETWEEN 0 AND "amount" AND "appliedAmount" = trunc("appliedAmount")
  AND ("disposition" = 'APPLIED' OR "appliedAmount" = 0)
  AND length(btrim("provider")) > 0 AND length(btrim("merchantId")) > 0
  AND length(btrim("providerTransactionId")) > 0
);

ALTER TABLE "BookingCancellation" ADD CONSTRAINT "BookingCancellation_policy_check" CHECK (
  "currency" = 'VND'
  AND "paidBasis" BETWEEN 0 AND 9999999999 AND "paidBasis" = trunc("paidBasis")
  AND "refundPercent" = CASE
    WHEN "cause" <> 'CUSTOMER_CANCELLATION' THEN 100
    WHEN "checkInAt" - "cancelledAt" >= INTERVAL '48 hours' THEN 100
    WHEN "checkInAt" - "cancelledAt" >= INTERVAL '24 hours' THEN 50
    ELSE 0 END
  AND "refundEntitlement" = floor("paidBasis" * "refundPercent" / 100)
  AND length(btrim("reason")) > 0 AND length(btrim("policyVersion")) > 0
  AND ("actorType" = 'SYSTEM' OR "actorUserId" IS NOT NULL)
  AND ("cause" <> 'OPERATOR_CANCELLATION' OR "actorType" IN ('STAFF', 'ADMIN'))
  AND ("cause" <> 'BOOKING_EXPIRY' OR "actorType" = 'SYSTEM')
);

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_vnd_check" CHECK (
  "currency" = 'VND' AND "amount" BETWEEN 1 AND 9999999999 AND "amount" = trunc("amount")
  AND length(btrim("idempotencyKey")) > 0
  AND ("status" <> 'SUCCEEDED' OR "processedAt" IS NOT NULL)
);

ALTER TABLE "RefundAttempt" ADD CONSTRAINT "RefundAttempt_identity_check" CHECK (
  "sequence" > 0 AND length(btrim("provider")) > 0 AND length(btrim("merchantId")) > 0
  AND length(btrim("providerRequestId")) > 0
  AND ("providerRefundReference" IS NULL OR length(btrim("providerRefundReference")) > 0)
);

ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_hash_check" CHECK (
  length(btrim("scope")) > 0
  AND "keyHash" ~ '^[0-9a-f]{64}$' AND "requestHash" ~ '^[0-9a-f]{64}$'
  AND ("httpStatus" IS NULL OR "httpStatus" BETWEEN 100 AND 599)
);

ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_fingerprint_check" CHECK (
  "eventFingerprint" IS NULL OR (
    "eventFingerprint" ~ '^[0-9a-f]{64}$'
    AND "merchantId" IS NOT NULL AND length(btrim("merchantId")) > 0
    AND "status" IS NOT NULL
  )
);

-- No existing row is changed. This transition invariant prevents every write
-- path (including the still-legacy callback) from resurrecting terminal bookings.
-- It does NOT implement payment handling, expiry or refund processing.
CREATE FUNCTION "rental_booking_terminal_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status"::text IN ('EXPIRED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_STAFF',
                           'CANCELLED_BY_ADMIN', 'COMPLETED', 'NO_SHOW')
     AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Terminal booking status cannot change'
      USING ERRCODE = '23514', CONSTRAINT = 'Booking_terminal_status_guard';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Booking_terminal_status_guard"
BEFORE UPDATE OF "status" ON "Booking"
FOR EACH ROW EXECUTE FUNCTION "rental_booking_terminal_guard"();

COMMIT;
