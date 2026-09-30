import {
  halfVnd,
  paymentAmounts,
  refundableRemainder,
  VndInput,
  vnd,
} from "./money";
import {
  BookingState,
  DomainRuleError,
  HoldState,
  PaymentOption,
  RefundCause,
} from "./states";

export const HOLD_TTL_MS = 15 * 60 * 1000;
export const BOOKING_PAYMENT_TTL_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function instant(date: Date): number {
  const result = date.getTime();
  if (!Number.isFinite(result))
    throw new DomainRuleError("INVALID_TIME", "A valid instant is required");
  return result;
}

function deadline(createdAt: Date, ttl: number): Date {
  const result = new Date(instant(createdAt) + ttl);
  instant(result);
  return result;
}
export const holdDeadline = (createdAt: Date): Date =>
  deadline(createdAt, HOLD_TTL_MS);
export const bookingPaymentDeadline = (createdAt: Date): Date =>
  deadline(createdAt, BOOKING_PAYMENT_TTL_MS);
export const isDue = (expiresAt: Date, now: Date): boolean =>
  instant(now) >= instant(expiresAt);

export function isUsableHold(
  state: HoldState,
  expiresAt: Date,
  now: Date,
): boolean {
  const due = isDue(expiresAt, now);
  return state === "ACTIVE" && !due;
}

export function isBookingPaymentExpired(
  state: BookingState,
  paymentDueAt: Date,
  now: Date,
): boolean {
  const due = isDue(paymentDueAt, now);
  return state === "PENDING_PAYMENT" && due;
}

/** Pure predicate only; caller must obtain fresh DB time and locked accounting first. */
export function mayConfirmBooking(input: {
  state: BookingState;
  paymentDueAt: Date;
  now: Date;
  total: VndInput;
  paid: VndInput;
  option: PaymentOption;
}): boolean {
  const due = isDue(input.paymentDueAt, input.now);
  const amounts = paymentAmounts(input.total, input.paid, input.option);
  return (
    input.state === "PENDING_PAYMENT" &&
    !due &&
    amounts.paid.gte(amounts.required)
  );
}

export interface RefundPolicyInput {
  cause: RefundCause;
  actualPaid: VndInput;
  alreadyRefunded?: VndInput;
  alreadyReserved?: VndInput;
  /** Frozen check-in instant and actual accepted cancellation instant; never client-supplied policy time. */
  checkInAt: Date;
  cancelledAt: Date;
}

/** Calculation only: does not create obligations, process payments, or issue refunds. */
export function refundEntitlement(input: RefundPolicyInput) {
  const hoursBefore =
    (instant(input.checkInAt) - instant(input.cancelledAt)) / HOUR_MS;
  const paid = vnd(input.actualPaid);
  const refunded = vnd(input.alreadyRefunded ?? "0"),
    reserved = vnd(input.alreadyReserved ?? "0");
  refundableRemainder(paid, refunded, reserved);
  let percent: 0 | 50 | 100;
  switch (input.cause) {
    case "CUSTOMER_CANCELLATION":
      percent = hoursBefore >= 48 ? 100 : hoursBefore >= 24 ? 50 : 0;
      break;
    case "OPERATOR_CANCELLATION":
    case "BOOKING_EXPIRY":
    case "LATE_CAPTURE":
    case "SUPERSEDED_CAPTURE":
      percent = 100;
      break;
    default:
      throw new DomainRuleError(
        "INVALID_REFUND_CAUSE",
        "Unsupported refund cause",
      );
  }
  const entitlement =
    percent === 100 ? paid : percent === 50 ? halfVnd(paid) : vnd("0");
  const outstanding = entitlement.sub(refunded).sub(reserved);
  return {
    percent,
    paidBasis: paid,
    entitlement,
    outstanding: outstanding.isNegative() ? vnd("0") : outstanding,
  };
}
