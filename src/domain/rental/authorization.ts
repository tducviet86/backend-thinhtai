import { BookingState, LegacyBookingState } from "./states";

/** Explicit read boundaries for future controller/select integration. No runtime guards changed in Phase 1. */
export const BOOKING_READ_PERMISSIONS = Object.freeze({
  operational: Object.freeze(["booking.read"]),
  customer: Object.freeze(["booking.read", "customer.read"]),
  payment: Object.freeze(["booking.read", "payment.read"]),
  financial: Object.freeze(["booking.read", "payment.read"]),
  audit: Object.freeze(["audit.read"]),
});
export type BookingReadScope = keyof typeof BOOKING_READ_PERMISSIONS;

export type ReadPrincipal =
  | { kind: "ANONYMOUS" }
  | { kind: "CUSTOMER"; userId: string }
  | { kind: "STAFF"; permissions: readonly string[] };

export function mayReadBooking(
  principal: ReadPrincipal,
  scope: BookingReadScope,
  ownerUserId: string | null,
): boolean {
  if (!Object.hasOwn(BOOKING_READ_PERMISSIONS, scope)) return false;
  if (principal.kind === "ANONYMOUS") return false;
  if (principal.kind === "CUSTOMER")
    return (
      scope !== "audit" &&
      !!principal.userId &&
      principal.userId === ownerUserId
    );
  return BOOKING_READ_PERMISSIONS[scope].every((permission) =>
    principal.permissions.includes(permission),
  );
}

/** Exact field contract; consumers must construct it explicitly, never spread database entities. */
export interface PublicBookingContract {
  readonly bookingCode: string;
  readonly status: BookingState | LegacyBookingState;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
  readonly unit: {
    readonly publicCode: string;
    readonly nameVi: string;
    readonly nameEn: string;
  };
}

export const PUBLIC_BOOKING_FIELDS = Object.freeze([
  "bookingCode",
  "status",
  "checkIn",
  "checkOut",
  "guestCount",
  "unit",
] as const);
