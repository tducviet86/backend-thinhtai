import { Prisma } from "@prisma/client";
import { DomainRuleError, PaymentOption, PaymentProgress } from "./states";

/** Isolate arithmetic from changes to the shared Decimal precision/rounding settings. */
const ExactDecimal = Prisma.Decimal.clone({
  precision: 40,
  rounding: Prisma.Decimal.ROUND_DOWN,
});
export type VndInput = string | Prisma.Decimal;
export const CURRENCY = "VND" as const;
/** Current Decimal(12,2) storage ceiling, expressed as integer VND. */
export const MAX_VND = "9999999999";

export function assertVndCurrency(
  currency: string,
): asserts currency is typeof CURRENCY {
  if (currency !== CURRENCY)
    throw new DomainRuleError("INVALID_CURRENCY", "Only VND is supported");
}

/** Reject JS numbers: converting an already-rounded float to Decimal cannot repair it. */
export function vnd(value: VndInput): Prisma.Decimal {
  if (typeof value !== "string" && !Prisma.Decimal.isDecimal(value)) {
    throw new DomainRuleError(
      "INVALID_MONEY",
      "Money must be a decimal string or Decimal",
    );
  }
  if (typeof value === "string" && !/^\d+(?:\.0+)?$/.test(value)) {
    throw new DomainRuleError(
      "INVALID_MONEY",
      "Money must be non-negative integer VND",
    );
  }
  const amount = new ExactDecimal(value);
  if (
    !amount.isFinite() ||
    !amount.isInteger() ||
    amount.isNegative() ||
    amount.gt(MAX_VND)
  ) {
    throw new DomainRuleError(
      "INVALID_MONEY",
      "Money is outside the integer VND storage range",
    );
  }
  return amount;
}

export function halfVnd(value: VndInput): Prisma.Decimal {
  return vnd(value).div("2").floor();
}

export function paymentAmounts(
  totalInput: VndInput,
  paidInput: VndInput,
  option: PaymentOption,
) {
  const total = vnd(totalInput),
    paid = vnd(paidInput);
  if (paid.gt(total))
    throw new DomainRuleError(
      "OVERPAYMENT",
      "Applied payments exceed the payable total",
    );
  if (option !== "DEPOSIT_50" && option !== "FULL_100")
    throw new DomainRuleError(
      "INVALID_PAYMENT_OPTION",
      "Unsupported payment option",
    );
  const deposit = halfVnd(total);
  const required = option === "DEPOSIT_50" ? deposit : total;
  const remaining = total.sub(paid);
  const requiredOutstanding = ExactDecimal.max(required.sub(paid), "0");
  const status: PaymentProgress = paid.eq(total)
    ? "PAID"
    : paid.isZero()
      ? "UNPAID"
      : "PARTIALLY_PAID";
  return {
    total,
    paid,
    deposit,
    required,
    remaining,
    requiredOutstanding,
    status,
  };
}

/** Counts pending obligations as reserved capacity, not merely completed refunds. */
export function refundableRemainder(
  capturedInput: VndInput,
  refundedInput: VndInput = "0",
  reservedInput: VndInput = "0",
): Prisma.Decimal {
  const captured = vnd(capturedInput),
    committed = vnd(refundedInput).add(vnd(reservedInput));
  if (committed.gt(captured))
    throw new DomainRuleError(
      "OVER_REFUND",
      "Refunds and obligations exceed captured money",
    );
  return captured.sub(committed);
}
