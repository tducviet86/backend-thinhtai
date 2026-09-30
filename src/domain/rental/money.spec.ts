import { Prisma } from "@prisma/client";
import {
  assertVndCurrency,
  halfVnd,
  MAX_VND,
  paymentAmounts,
  refundableRemainder,
  vnd,
  VndInput,
} from "./money";

describe("integer VND contracts", () => {
  it.each(["0", "1", "1000001", MAX_VND])(
    "preserves %s VND exactly",
    (value) => {
      expect(vnd(value).toFixed(0)).toBe(value);
      expect(vnd(new Prisma.Decimal(value)).toFixed(0)).toBe(value);
    },
  );
  it.each(["-1", "0.5", "NaN", "Infinity", "1e3", "", "10000000000"])(
    "rejects invalid/storage-incompatible value %s",
    (value) => {
      expect(() => vnd(value)).toThrow();
    },
  );
  it("rejects numeric inputs and fractional/non-finite Decimal values", () => {
    for (const value of [
      1,
      0.1 + 0.2,
      new Prisma.Decimal("1.5"),
      new Prisma.Decimal("NaN"),
      new Prisma.Decimal("Infinity"),
    ]) {
      expect(() => vnd(value as VndInput)).toThrow();
    }
  });
  it("accepts legacy Decimal scale without accepting fractional VND", () => {
    expect(vnd("1000.00").toFixed(0)).toBe("1000");
    expect(() => vnd("1000.01")).toThrow();
  });
  it.each([
    ["0", "0"],
    ["1", "0"],
    ["3", "1"],
    ["1000001", "500000"],
    [MAX_VND, "4999999999"],
  ])("floors 50%% of %s to %s", (total, expected) => {
    expect(halfVnd(total).toFixed(0)).toBe(expected);
  });
  it("is unaffected by changes to global Decimal precision", () => {
    const precision = Prisma.Decimal.precision;
    try {
      Prisma.Decimal.set({ precision: 3 });
      expect(halfVnd(MAX_VND).toFixed(0)).toBe("4999999999");
      expect(
        paymentAmounts(MAX_VND, "1", "FULL_100").remaining.toFixed(0),
      ).toBe("9999999998");
    } finally {
      Prisma.Decimal.set({ precision });
    }
  });
  it("uses the chosen confirmation target and deducts previous partial payments", () => {
    const deposit = paymentAmounts("1000001", "200000", "DEPOSIT_50");
    expect(deposit.required.toFixed(0)).toBe("500000");
    expect(deposit.requiredOutstanding.toFixed(0)).toBe("300000");
    expect(deposit.remaining.toFixed(0)).toBe("800001");
    expect(deposit.status).toBe("PARTIALLY_PAID");
    const full = paymentAmounts("1000001", "200000", "FULL_100");
    expect(full.requiredOutstanding.toFixed(0)).toBe("800001");
  });
  it("never creates a negative charge after reaching the target", () => {
    expect(
      paymentAmounts("1000", "600", "DEPOSIT_50").requiredOutstanding.toFixed(
        0,
      ),
    ).toBe("0");
    expect(paymentAmounts("1000", "1000", "FULL_100").status).toBe("PAID");
    expect(paymentAmounts("1000", "0", "DEPOSIT_50").status).toBe("UNPAID");
    expect(() => paymentAmounts("1000", "1001", "FULL_100")).toThrow("exceed");
  });
  it("rejects unsupported currency and payment options", () => {
    expect(() => assertVndCurrency("VND")).not.toThrow();
    expect(() => assertVndCurrency("USD")).toThrow();
    expect(() => paymentAmounts("100", "0", "OTHER" as "FULL_100")).toThrow();
  });
  it("reserves refund capacity for both completed and pending refunds", () => {
    expect(refundableRemainder("1000", "100", "500").toFixed(0)).toBe("400");
    expect(() => refundableRemainder("1000", "600", "500")).toThrow();
  });
});
