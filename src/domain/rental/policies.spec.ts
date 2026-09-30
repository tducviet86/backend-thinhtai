import {
  bookingPaymentDeadline,
  holdDeadline,
  isBookingPaymentExpired,
  isDue,
  isUsableHold,
  mayConfirmBooking,
  refundEntitlement,
} from "./policies";
import { RefundCause } from "./states";

describe("reservation deadlines", () => {
  const createdAt = new Date("2026-09-28T10:00:00Z");
  it("uses exactly 15 minutes for holds and 30 minutes for bookings without mutating creation time", () => {
    expect(holdDeadline(createdAt).toISOString()).toBe(
      "2026-09-28T10:15:00.000Z",
    );
    expect(bookingPaymentDeadline(createdAt).toISOString()).toBe(
      "2026-09-28T10:30:00.000Z",
    );
    expect(createdAt.toISOString()).toBe("2026-09-28T10:00:00.000Z");
  });
  it("expires at the exact hold boundary regardless of worker state", () => {
    const expiresAt = holdDeadline(createdAt);
    expect(isUsableHold("ACTIVE", expiresAt, new Date(+expiresAt - 1))).toBe(
      true,
    );
    expect(isUsableHold("ACTIVE", expiresAt, expiresAt)).toBe(false);
    for (const state of ["CONVERTED", "CANCELLED", "EXPIRED"] as const) {
      expect(isUsableHold(state, expiresAt, createdAt)).toBe(false);
    }
  });
  it("expires only pending bookings; callbacks at the exact deadline cannot confirm", () => {
    const paymentDueAt = bookingPaymentDeadline(createdAt);
    expect(
      isBookingPaymentExpired("PENDING_PAYMENT", paymentDueAt, paymentDueAt),
    ).toBe(true);
    expect(
      isBookingPaymentExpired("CONFIRMED", paymentDueAt, paymentDueAt),
    ).toBe(false);
    const input = {
      state: "PENDING_PAYMENT",
      paymentDueAt,
      total: "1001",
      paid: "500",
      option: "DEPOSIT_50",
    } as const;
    expect(
      mayConfirmBooking({ ...input, now: new Date(+paymentDueAt - 1) }),
    ).toBe(true);
    expect(mayConfirmBooking({ ...input, now: paymentDueAt })).toBe(false);
    expect(
      mayConfirmBooking({ ...input, now: createdAt, option: "FULL_100" }),
    ).toBe(false);
    expect(
      mayConfirmBooking({
        ...input,
        now: createdAt,
        option: "FULL_100",
        paid: "1001",
      }),
    ).toBe(true);
  });
  it("cannot confirm a terminal booking even with full payment", () => {
    for (const state of [
      "EXPIRED",
      "CANCELLED_BY_CUSTOMER",
      "CANCELLED_BY_STAFF",
      "CANCELLED_BY_ADMIN",
      "COMPLETED",
      "NO_SHOW",
    ] as const) {
      expect(
        mayConfirmBooking({
          state,
          paymentDueAt: bookingPaymentDeadline(createdAt),
          now: createdAt,
          total: "1000",
          paid: "1000",
          option: "FULL_100",
        }),
      ).toBe(false);
    }
  });
  it("rejects invalid instants rather than treating them as unexpired", () => {
    expect(() => isDue(new Date("invalid"), createdAt)).toThrow();
    expect(() => holdDeadline(new Date("invalid"))).toThrow();
    expect(() => holdDeadline(new Date(8640000000000000))).toThrow();
  });
});

describe("refund entitlement calculations, not refund execution", () => {
  const checkInAt = new Date("2026-10-05T07:00:00Z"); // 14:00 in Vietnam
  it.each([
    [48 * 3600000, 100, "1001"],
    [48 * 3600000 - 1, 50, "500"],
    [24 * 3600000, 50, "500"],
    [24 * 3600000 - 1, 0, "0"],
    [0, 0, "0"],
    [-3600000, 0, "0"],
  ])(
    "uses cancellation offset %s ms -> %s%% of actual paid",
    (offset, percent, entitlement) => {
      const result = refundEntitlement({
        cause: "CUSTOMER_CANCELLATION",
        actualPaid: "1001",
        checkInAt,
        cancelledAt: new Date(+checkInAt - offset),
      });
      expect(result.percent).toBe(percent);
      expect(result.entitlement.toFixed(0)).toBe(entitlement);
      expect(result.paidBasis.toFixed(0)).toBe("1001");
    },
  );
  it.each<RefundCause>([
    "OPERATOR_CANCELLATION",
    "BOOKING_EXPIRY",
    "LATE_CAPTURE",
    "SUPERSEDED_CAPTURE",
  ])(
    "%s returns all actual money even inside the customer penalty window",
    (cause) => {
      const result = refundEntitlement({
        cause,
        actualPaid: "301",
        checkInAt,
        cancelledAt: new Date(+checkInAt - 1),
      });
      expect(result.percent).toBe(100);
      expect(result.entitlement.toFixed(0)).toBe("301");
    },
  );
  it("deducts existing allocations and does not create duplicate entitlement", () => {
    const input = {
      cause: "CUSTOMER_CANCELLATION",
      actualPaid: "1001",
      checkInAt,
      cancelledAt: new Date(+checkInAt - 24 * 3600000),
    } as const;
    expect(
      refundEntitlement({
        ...input,
        alreadyRefunded: "200",
        alreadyReserved: "300",
      }).outstanding.toFixed(0),
    ).toBe("0");
    expect(
      refundEntitlement({
        ...input,
        alreadyRefunded: "501",
      }).outstanding.toFixed(0),
    ).toBe("0");
    expect(() =>
      refundEntitlement({
        ...input,
        alreadyRefunded: "800",
        alreadyReserved: "300",
      }),
    ).toThrow();
    expect(
      refundEntitlement({ ...input, actualPaid: "0" }).entitlement.toFixed(0),
    ).toBe("0");
  });
});
