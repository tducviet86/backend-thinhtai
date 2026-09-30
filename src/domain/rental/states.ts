/** Phase 1 contracts. These are NOT Prisma enums or persistence adapters. */
export type DomainActor =
  | "CUSTOMER"
  | "STAFF"
  | "ADMIN"
  | "SYSTEM"
  | "PAYMENT_PROCESSOR"
  | "REFUND_WORKER";

export const HOLD_STATES = [
  "ACTIVE",
  "CONVERTED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type HoldState = (typeof HOLD_STATES)[number];
export const BOOKING_STATES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_STAFF",
  "CANCELLED_BY_ADMIN",
  "EXPIRED",
  "NO_SHOW",
] as const;
export type BookingState = (typeof BOOKING_STATES)[number];
/** Legacy rows need an explicit migration policy; new flows must not emit these. */
export type LegacyBookingState = "DRAFT" | "PAYMENT_FAILED";
export const PAYMENT_ATTEMPT_STATES = [
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "SUPERSEDED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type PaymentAttemptState = (typeof PAYMENT_ATTEMPT_STATES)[number];
export const REFUND_STATES = [
  "REQUESTED",
  "PROCESSING",
  "PENDING_PROVIDER",
  "SUCCEEDED",
  "RETRYABLE_FAILED",
  "MANUAL_REVIEW",
] as const;
export type RefundState = (typeof REFUND_STATES)[number];
export type PaymentOption = "DEPOSIT_50" | "FULL_100";
export type PaymentProgress = "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type CaptureDisposition =
  "APPLIED" | "REFUND_REQUIRED" | "REVIEW_REQUIRED";
export type RefundCause =
  | "CUSTOMER_CANCELLATION"
  | "OPERATOR_CANCELLATION"
  | "BOOKING_EXPIRY"
  | "LATE_CAPTURE"
  | "SUPERSEDED_CAPTURE";

export class DomainRuleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainRuleError";
  }
}

type Transitions<S extends string> = Readonly<
  Record<S, Readonly<Partial<Record<S, readonly DomainActor[]>>>>
>;

const holdTransitions: Transitions<HoldState> = {
  ACTIVE: {
    CONVERTED: ["CUSTOMER", "STAFF", "ADMIN"],
    CANCELLED: ["CUSTOMER", "STAFF", "ADMIN"],
    EXPIRED: ["SYSTEM"],
  },
  CONVERTED: {},
  CANCELLED: {},
  EXPIRED: {},
};
const cancellations = {
  CANCELLED_BY_CUSTOMER: ["CUSTOMER"],
  CANCELLED_BY_STAFF: ["STAFF"],
  CANCELLED_BY_ADMIN: ["ADMIN"],
} as const;
const bookingTransitions: Transitions<BookingState> = {
  PENDING_PAYMENT: {
    CONFIRMED: ["PAYMENT_PROCESSOR"],
    EXPIRED: ["SYSTEM"],
    ...cancellations,
  },
  CONFIRMED: {
    CHECKED_IN: ["STAFF", "ADMIN"],
    NO_SHOW: ["STAFF", "ADMIN"],
    ...cancellations,
  },
  CHECKED_IN: { CHECKED_OUT: ["STAFF", "ADMIN"] },
  CHECKED_OUT: { COMPLETED: ["STAFF", "ADMIN", "SYSTEM"] },
  COMPLETED: {},
  CANCELLED_BY_CUSTOMER: {},
  CANCELLED_BY_STAFF: {},
  CANCELLED_BY_ADMIN: {},
  EXPIRED: {},
  NO_SHOW: {},
};
const attemptOutcomes = {
  PAID: ["PAYMENT_PROCESSOR"],
  FAILED: ["PAYMENT_PROCESSOR"],
  SUPERSEDED: ["CUSTOMER", "STAFF", "ADMIN"],
  EXPIRED: ["SYSTEM"],
  CANCELLED: ["SYSTEM"],
} as const;
const paymentTransitions: Transitions<PaymentAttemptState> = {
  PENDING: { PROCESSING: ["PAYMENT_PROCESSOR"], ...attemptOutcomes },
  PROCESSING: attemptOutcomes,
  PAID: {},
  FAILED: {},
  SUPERSEDED: {},
  EXPIRED: {},
  CANCELLED: {},
};
const refundTransitions: Transitions<RefundState> = {
  REQUESTED: {
    PROCESSING: ["REFUND_WORKER"],
    MANUAL_REVIEW: ["REFUND_WORKER"],
  },
  PROCESSING: {
    PENDING_PROVIDER: ["REFUND_WORKER"],
    SUCCEEDED: ["REFUND_WORKER"],
    RETRYABLE_FAILED: ["REFUND_WORKER"],
    MANUAL_REVIEW: ["REFUND_WORKER"],
  },
  PENDING_PROVIDER: {
    SUCCEEDED: ["REFUND_WORKER"],
    RETRYABLE_FAILED: ["REFUND_WORKER"],
    MANUAL_REVIEW: ["REFUND_WORKER"],
  },
  RETRYABLE_FAILED: {
    PROCESSING: ["REFUND_WORKER"],
    MANUAL_REVIEW: ["REFUND_WORKER"],
  },
  MANUAL_REVIEW: {
    PENDING_PROVIDER: ["REFUND_WORKER"],
    SUCCEEDED: ["REFUND_WORKER"],
    RETRYABLE_FAILED: ["REFUND_WORKER"],
  },
  SUCCEEDED: {},
};

function assertTransition<S extends string>(
  table: Transitions<S>,
  from: S,
  to: S,
  actor: DomainActor,
): void {
  const allowed =
    Object.hasOwn(table, from) && Object.hasOwn(table[from], to)
      ? table[from][to]
      : undefined;
  if (!allowed?.includes(actor)) {
    throw new DomainRuleError(
      "INVALID_TRANSITION",
      `${actor} cannot transition ${from} -> ${to}`,
    );
  }
}

/** State/actor checks only. Ownership, evidence and locked-state validation are additional requirements. */
export const assertHoldTransition = (
  from: HoldState,
  to: HoldState,
  actor: DomainActor,
): void => assertTransition(holdTransitions, from, to, actor);
export const assertBookingTransition = (
  from: BookingState,
  to: BookingState,
  actor: DomainActor,
): void => assertTransition(bookingTransitions, from, to, actor);
export const assertPaymentTransition = (
  from: PaymentAttemptState,
  to: PaymentAttemptState,
  actor: DomainActor,
): void => assertTransition(paymentTransitions, from, to, actor);
export const assertRefundTransition = (
  from: RefundState,
  to: RefundState,
  actor: DomainActor,
): void => assertTransition(refundTransitions, from, to, actor);

export function isTerminalBooking(state: BookingState): boolean {
  return [
    "COMPLETED",
    "CANCELLED_BY_CUSTOMER",
    "CANCELLED_BY_STAFF",
    "CANCELLED_BY_ADMIN",
    "EXPIRED",
    "NO_SHOW",
  ].includes(state);
}
