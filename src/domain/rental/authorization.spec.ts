import {
  BOOKING_READ_PERMISSIONS,
  mayReadBooking,
  PUBLIC_BOOKING_FIELDS,
} from "./authorization";

describe("booking response authorization contract", () => {
  it("booking.read alone never grants customer, payment, financial or audit information", () => {
    const staff = { kind: "STAFF", permissions: ["booking.read"] } as const;
    expect(mayReadBooking(staff, "operational", null)).toBe(true);
    for (const scope of [
      "customer",
      "payment",
      "financial",
      "audit",
    ] as const) {
      expect(mayReadBooking(staff, scope, null)).toBe(false);
    }
  });
  it("requires both object-domain and sensitive-data permissions for nested views", () => {
    expect(
      mayReadBooking(
        { kind: "STAFF", permissions: ["payment.read"] },
        "financial",
        null,
      ),
    ).toBe(false);
    expect(
      mayReadBooking(
        { kind: "STAFF", permissions: ["booking.read", "payment.read"] },
        "financial",
        null,
      ),
    ).toBe(true);
    expect(
      mayReadBooking(
        { kind: "STAFF", permissions: ["booking.read", "customer.read"] },
        "customer",
        null,
      ),
    ).toBe(true);
    expect(
      mayReadBooking(
        { kind: "STAFF", permissions: ["booking.read", "payment.confirm"] },
        "payment",
        null,
      ),
    ).toBe(false);
  });
  it("allows only the canonical customer owner and excludes internal audit even for the owner", () => {
    const customer = { kind: "CUSTOMER", userId: "user-1" } as const;
    expect(mayReadBooking(customer, "financial", "user-1")).toBe(true);
    expect(mayReadBooking(customer, "customer", "user-2")).toBe(false);
    expect(mayReadBooking(customer, "operational", null)).toBe(false);
    expect(mayReadBooking(customer, "audit", "user-1")).toBe(false);
  });
  it("does not grant protected projections to anonymous callers", () => {
    for (const scope of Object.keys(
      BOOKING_READ_PERMISSIONS,
    ) as (keyof typeof BOOKING_READ_PERMISSIONS)[]) {
      expect(mayReadBooking({ kind: "ANONYMOUS" }, scope, null)).toBe(false);
    }
  });
  it("defines a minimal public allowlist without financial or internal fields", () => {
    expect(PUBLIC_BOOKING_FIELDS).toEqual([
      "bookingCode",
      "status",
      "checkIn",
      "checkOut",
      "guestCount",
      "unit",
    ]);
    for (const field of [
      "customer",
      "payments",
      "total",
      "paidAmount",
      "remainingAmount",
      "paymentStatus",
      "createdByUserId",
      "audit",
    ]) {
      expect(PUBLIC_BOOKING_FIELDS).not.toContain(field);
    }
  });
});
