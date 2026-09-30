import {
  assertBookingTransition,
  assertHoldTransition,
  assertPaymentTransition,
  assertRefundTransition,
  BOOKING_STATES,
  BookingState,
  isTerminalBooking,
} from "./states";

describe("rental state and actor contracts", () => {
  it("allows a token-authorized holder conversion but no expired hold revival", () => {
    expect(() =>
      assertHoldTransition("ACTIVE", "CONVERTED", "CUSTOMER"),
    ).not.toThrow();
    expect(() =>
      assertHoldTransition("ACTIVE", "EXPIRED", "SYSTEM"),
    ).not.toThrow();
    for (const state of ["CONVERTED", "CANCELLED", "EXPIRED"] as const) {
      expect(() => assertHoldTransition(state, "ACTIVE", "CUSTOMER")).toThrow();
      expect(() =>
        assertHoldTransition(state, "CONVERTED", "CUSTOMER"),
      ).toThrow();
    }
  });
  it("only the payment application boundary may confirm a pending booking", () => {
    expect(() =>
      assertBookingTransition(
        "PENDING_PAYMENT",
        "CONFIRMED",
        "PAYMENT_PROCESSOR",
      ),
    ).not.toThrow();
    expect(() =>
      assertBookingTransition("PENDING_PAYMENT", "CONFIRMED", "STAFF"),
    ).toThrow();
    expect(() =>
      assertBookingTransition("PENDING_PAYMENT", "CONFIRMED", "CUSTOMER"),
    ).toThrow();
    expect(() =>
      assertBookingTransition("PENDING_PAYMENT", "EXPIRED", "SYSTEM"),
    ).not.toThrow();
  });
  it("distinguishes customer cancellation from staff/admin cancellation", () => {
    expect(() =>
      assertBookingTransition("CONFIRMED", "CANCELLED_BY_CUSTOMER", "CUSTOMER"),
    ).not.toThrow();
    expect(() =>
      assertBookingTransition("CONFIRMED", "CANCELLED_BY_STAFF", "STAFF"),
    ).not.toThrow();
    expect(() =>
      assertBookingTransition("CONFIRMED", "CANCELLED_BY_ADMIN", "ADMIN"),
    ).not.toThrow();
    expect(() =>
      assertBookingTransition("CONFIRMED", "CANCELLED_BY_STAFF", "CUSTOMER"),
    ).toThrow();
    expect(() =>
      assertBookingTransition(
        "CHECKED_IN",
        "CANCELLED_BY_CUSTOMER",
        "CUSTOMER",
      ),
    ).toThrow();
  });
  it.each<BookingState>([
    "EXPIRED",
    "CANCELLED_BY_CUSTOMER",
    "CANCELLED_BY_STAFF",
    "CANCELLED_BY_ADMIN",
    "COMPLETED",
    "NO_SHOW",
  ])("prevents every outgoing transition from terminal %s", (from) => {
    expect(isTerminalBooking(from)).toBe(true);
    for (const to of BOOKING_STATES) {
      for (const actor of [
        "CUSTOMER",
        "STAFF",
        "ADMIN",
        "SYSTEM",
        "PAYMENT_PROCESSOR",
        "REFUND_WORKER",
      ] as const) {
        expect(() => assertBookingTransition(from, to, actor)).toThrow();
      }
    }
  });
  it("preserves the ordered operational lifecycle and rejects skipped states", () => {
    expect(isTerminalBooking("CHECKED_OUT")).toBe(false);
    expect(() =>
      assertBookingTransition("CONFIRMED", "CHECKED_IN", "STAFF"),
    ).not.toThrow();
    expect(() =>
      assertBookingTransition("CHECKED_IN", "CHECKED_OUT", "STAFF"),
    ).not.toThrow();
    expect(() =>
      assertBookingTransition("CHECKED_OUT", "COMPLETED", "SYSTEM"),
    ).not.toThrow();
    expect(() =>
      assertBookingTransition("CONFIRMED", "COMPLETED", "STAFF"),
    ).toThrow();
  });
  it("does not reopen closed payment attempts when late money is observed", () => {
    expect(() =>
      assertPaymentTransition("PROCESSING", "PAID", "PAYMENT_PROCESSOR"),
    ).not.toThrow();
    expect(() =>
      assertPaymentTransition("PENDING", "SUPERSEDED", "CUSTOMER"),
    ).not.toThrow();
    for (const state of [
      "PAID",
      "FAILED",
      "SUPERSEDED",
      "EXPIRED",
      "CANCELLED",
    ] as const) {
      expect(() =>
        assertPaymentTransition(state, "PAID", "PAYMENT_PROCESSOR"),
      ).toThrow();
      expect(() =>
        assertPaymentTransition(state, "PENDING", "CUSTOMER"),
      ).toThrow();
    }
  });
  it("requires evidence-backed reconciliation before an uncertain refund can be retried", () => {
    expect(() =>
      assertRefundTransition("PROCESSING", "PENDING_PROVIDER", "REFUND_WORKER"),
    ).not.toThrow();
    expect(() =>
      assertRefundTransition("PENDING_PROVIDER", "PROCESSING", "REFUND_WORKER"),
    ).toThrow();
    expect(() =>
      assertRefundTransition(
        "PENDING_PROVIDER",
        "RETRYABLE_FAILED",
        "REFUND_WORKER",
      ),
    ).not.toThrow();
    expect(() =>
      assertRefundTransition("RETRYABLE_FAILED", "PROCESSING", "REFUND_WORKER"),
    ).not.toThrow();
    expect(() =>
      assertRefundTransition("SUCCEEDED", "PROCESSING", "REFUND_WORKER"),
    ).toThrow();
    expect(() =>
      assertRefundTransition("PROCESSING", "SUCCEEDED", "STAFF"),
    ).toThrow();
  });
  it("rejects unknown/legacy states and prototype-property names", () => {
    for (const from of ["DRAFT", "PAYMENT_FAILED", "constructor", "UNKNOWN"]) {
      expect(() =>
        assertBookingTransition(
          from as BookingState,
          "CONFIRMED",
          "PAYMENT_PROCESSOR",
        ),
      ).toThrow();
    }
    expect(() =>
      assertBookingTransition(
        "PENDING_PAYMENT",
        "constructor" as BookingState,
        "CUSTOMER",
      ),
    ).toThrow();
  });
});
