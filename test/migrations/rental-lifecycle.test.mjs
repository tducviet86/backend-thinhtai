import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

// Always starts its own cluster. Never reads DATABASE_URL or connects to an
// existing server. Keep temporary files for inspection; stop only this server.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scratch = mkdtempSync(join(tmpdir(), "rental-phase2-"));
const data = join(scratch, "data");
const pg = (name) =>
  process.env.PG_BIN ? join(process.env.PG_BIN, name) : name;
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("PG")),
);
const connection = [
  "-X",
  "-h",
  scratch,
  "-U",
  "phase2",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-v",
  "VERBOSITY=verbose",
  "-At",
];
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
let started = false;
let legacy;

function sql(command) {
  const result = spawnSync(pg("psql"), [...connection, "-c", command], {
    env,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function accepts(command) {
  sql(`BEGIN; ${command}; ROLLBACK;`);
}
function rejects(command, constraint) {
  const result = spawnSync(
    pg("psql"),
    [...connection, "-c", `BEGIN; ${command}; ROLLBACK;`],
    { env, encoding: "utf8" },
  );
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.ok(result.stderr.includes(constraint), result.stderr);
}
function file(path) {
  return sql(readFileSync(join(root, path), "utf8"));
}
function rows(table) {
  return JSON.parse(
    sql(`SELECT coalesce(json_agg(t ORDER BY "id"), '[]') FROM "${table}" t`),
  );
}

function booking(n, extra = {}) {
  const values = {
    id: uid(n),
    bookingCode: `TEST-${n}`,
    customerId: uid(2),
    unitId: uid(5),
    source: "WEBSITE",
    checkIn: "2030-01-01",
    checkOut: "2030-01-03",
    guestCount: 1,
    status: "PENDING_PAYMENT",
    currency: "VND",
    subtotal: "1001",
    fees: "0",
    discount: "0",
    total: "1001",
    depositRequired: "500",
    paidAmount: "0",
    remainingAmount: "1001",
    createdAt: "2026-09-30T10:00:00Z",
    updatedAt: "2026-09-30T10:00:00Z",
    ...extra,
  };
  return `INSERT INTO "Booking" (${Object.keys(values)
    .map((k) => `"${k}"`)
    .join(",")}) VALUES (${Object.values(values).map(q).join(",")})`;
}
function payment(n, extra = "") {
  return `INSERT INTO "Payment" ("id", "bookingId", "type", "method", "provider", "providerReference", "amount", "currency", "purpose", "merchantId", "expiresAt", "providerCreateDate")
    VALUES ('${uid(n)}', '${uid(10)}', 'DEPOSIT', 'VNPAY', 'VNPAY', 'ref-${n}', 500, 'VND', 'INITIAL', 'merchant', '2030-01-01Z', '20260930170000') ${extra}`;
}
function capture(n, bookingId = uid(10), transaction = `txn-${n}`) {
  return `INSERT INTO "PaymentCapture" ("id", "paymentId", "bookingId", "provider", "merchantId", "providerTransactionId", "amount", "currency", "appliedAmount", "disposition")
    VALUES ('${uid(n)}', '${uid(20)}', '${bookingId}', 'VNPAY', 'merchant', '${transaction}', 500, 'VND', 0, 'REFUND_REQUIRED')`;
}
function refund(n, extra = {}) {
  const values = {
    id: uid(n),
    bookingId: uid(10),
    captureId: uid(30),
    amount: "500",
    currency: "VND",
    reason: "LATE_CAPTURE",
    idempotencyKey: `refund-${n}`,
    ...extra,
  };
  return `INSERT INTO "Refund" (${Object.keys(values)
    .map((k) => `"${k}"`)
    .join(",")}) VALUES (${Object.values(values).map(q).join(",")})`;
}
function execution(n, sequence) {
  return `INSERT INTO "RefundAttempt" ("id", "refundId", "sequence", "provider", "merchantId", "providerRequestId", "requestPayload")
    VALUES ('${uid(n)}', '${uid(40)}', ${sequence}, 'VNPAY', 'merchant', 'request-${n}', '{}')`;
}

before(
  () => {
    execFileSync(
      pg("initdb"),
      [
        "-D",
        data,
        "-U",
        "phase2",
        "--auth=trust",
        "--no-locale",
        "--encoding=UTF8",
      ],
      { env, stdio: "pipe" },
    );
    execFileSync(
      pg("pg_ctl"),
      [
        "-D",
        data,
        "-l",
        join(scratch, "postgres.log"),
        "-o",
        `-k ${scratch} -c listen_addresses='' -c timezone=UTC`,
        "-w",
        "start",
      ],
      { env, stdio: "pipe" },
    );
    started = true;
    const migrations = readdirSync(join(root, "prisma/migrations"))
      .filter((p) => /^\d/.test(p))
      .sort();
    for (const name of migrations.filter((p) => p < "202609290001"))
      file(`prisma/migrations/${name}/migration.sql`);
    sql(`
    INSERT INTO "User" ("id", "email", "passwordHash", "firstName", "lastName", "updatedAt") VALUES ('${uid(1)}', 'fixture@example.test', 'fixture', 'Test', 'User', now());
    INSERT INTO "Customer" ("id", "userId", "firstName", "lastName", "email", "phone", "updatedAt") VALUES ('${uid(2)}', '${uid(1)}', 'Test', 'User', 'fixture@example.test', '000', now());
    INSERT INTO "Location" ("id", "type", "nameVi", "nameEn", "slugVi", "slugEn", "updatedAt") VALUES ('${uid(3)}', 'CITY', 'Test', 'Test', 'test', 'test', now());
    INSERT INTO "Property" ("id", "name", "slugVi", "slugEn", "descriptionVi", "descriptionEn", "locationId", "address", "latitude", "longitude", "checkInTime", "checkOutTime", "updatedAt") VALUES ('${uid(4)}', 'Test', 'test', 'test', '', '', '${uid(3)}', 'Test', 0, 0, '14:00', '12:00', now());
    INSERT INTO "Unit" ("id", "propertyId", "internalCode", "publicCode", "nameVi", "nameEn", "slugVi", "slugEn", "descriptionVi", "descriptionEn", "bedroomCount", "bathroomCount", "bedCount", "maxGuests", "area", "basePrice", "currency", "updatedAt") VALUES ('${uid(5)}', '${uid(4)}', 'TEST', 'TEST', 'Test', 'Test', 'test', 'test', '', '', 1, 1, 1, 2, 30, 1000, 'VND', now());
    ${booking(10, { total: "1000", subtotal: "1000", depositRequired: "300", remainingAmount: "1000" })};
    ${booking(11, { status: "CANCELLED_BY_CUSTOMER", currency: "USD", subtotal: "1000.25", total: "1000.25", paidAmount: "300.50", remainingAmount: "699.75", depositRequired: "300.08" })};
    INSERT INTO "Hold" ("id", "unitId", "bookingDraftId", "startDate", "endDate", "expiresAt") VALUES ('${uid(12)}', '${uid(5)}', '${uid(999)}', '2030-01-04', '2030-01-06', '2030-01-01');
    INSERT INTO "Payment" ("id", "bookingId", "type", "method", "amount", "currency", "status") VALUES ('${uid(13)}', '${uid(11)}', 'DEPOSIT', 'CASH', 300.50, 'USD', 'PAID');
    INSERT INTO "RefreshToken" ("id", "userId", "tokenHash", "expiresAt", "replacedById") VALUES ('${uid(14)}', '${uid(1)}', 'legacy-hash', '2030-01-01', '${uid(998)}');
  `);
    legacy = Object.fromEntries(
      [
        "User",
        "Customer",
        "Location",
        "Property",
        "Unit",
        "Booking",
        "Hold",
        "Payment",
        "RefreshToken",
      ].map((t) => [t, rows(t)]),
    );
    file("scripts/rental-phase2-preflight.sql");
    for (const name of migrations.filter((p) => p >= "202609290001"))
      file(`prisma/migrations/${name}/migration.sql`);
  },
  { timeout: 30000 },
);

after(() => {
  if (started)
    execFileSync(pg("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], {
      env,
      stdio: "pipe",
    });
  console.log(`Isolated database files retained at ${scratch}`);
});

test("migration chain preserves every original fixture field, including fractional legacy money and orphan links", () => {
  for (const [table, originals] of Object.entries(legacy)) {
    const actual = rows(table);
    assert.equal(actual.length, originals.length);
    originals.forEach((original, i) => {
      assert.deepEqual(
        Object.fromEntries(Object.keys(original).map((k) => [k, actual[i][k]])),
        original,
        table,
      );
    });
  }
  assert.equal(
    sql(
      `SELECT count(*) FROM "Booking" WHERE "paymentOption" IS NOT NULL OR "paymentDueAt" IS NOT NULL`,
    ),
    "0",
  );
  assert.equal(
    sql(`SELECT count(*) FROM "Hold" WHERE "tokenHash" IS NOT NULL`),
    "0",
  );
  assert.equal(
    sql(`SELECT count(*) FROM "RefreshToken" WHERE "consumedAt" IS NOT NULL`),
    "0",
  );
});

test("read-only preflight works after expansion and identifies legacy anomalies", () => {
  const output = file("scripts/rental-phase2-preflight.sql");
  assert.ok(output.includes("refresh_rotation_review|1|0|0|0"));
  assert.ok(output.includes("booking_policy_classification|2|0"));
  assert.equal(
    sql(
      `SELECT count(*) FROM pg_constraint WHERE conname IN ('Hold_bookingDraftId_fkey', 'RefreshToken_replacedById_fkey') AND NOT convalidated`,
    ),
    "2",
  );
});

test("Prisma schema matches the complete migrated database", () => {
  const url = `postgresql://phase2@localhost/postgres?host=${encodeURIComponent(scratch)}`;
  const result = spawnSync(
    join(root, "node_modules/.bin/prisma"),
    [
      "migrate",
      "diff",
      "--from-url",
      url,
      "--to-schema-datamodel",
      join(root, "prisma/schema.prisma"),
      "--exit-code",
    ],
    { cwd: root, env: { ...env, DATABASE_URL: url }, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("existing overlap constraint rejects double booking but permits same-day turnover and EXPIRED rows", () => {
  rejects(booking(100), "Booking_no_occupying_overlap");
  accepts(booking(100, { checkIn: "2030-01-03", checkOut: "2030-01-04" }));
  accepts(booking(100, { status: "EXPIRED" }));
});

test("new-policy booking targets use integer VND and exact UTC deadlines even in a non-UTC session", () => {
  const contract = {
    checkIn: "2030-02-01",
    checkOut: "2030-02-03",
    paymentOption: "DEPOSIT_50",
    confirmationRequired: "500",
    paymentDueAt: "2026-09-30T10:30:00Z",
    checkInAt: "2030-02-01T07:00:00Z",
    stayTimeZone: "Asia/Ho_Chi_Minh",
    policyVersion: "rental-v1",
  };
  accepts(`SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh'; ${booking(100, contract)}`);
  accepts(
    booking(100, {
      ...contract,
      paymentOption: "FULL_100",
      confirmationRequired: "1001",
    }),
  );
  for (const invalid of [
    { confirmationRequired: "501" },
    { paymentDueAt: "2026-09-30T10:30:01Z" },
    { currency: "USD" },
    { total: "1001.50" },
    { paidAmount: "1002", remainingAmount: "-1" },
  ]) {
    rejects(
      booking(100, { ...contract, ...invalid }),
      "Booking_payment_contract_check",
    );
  }
});

test("hold capabilities require client proof hash, original TTL and conversion evidence", () => {
  const hold = `INSERT INTO "Hold" ("id", "unitId", "startDate", "endDate", "createdAt", "expiresAt", "tokenHash", "clientKeyHash") VALUES ('${uid(100)}', '${uid(5)}', '2030-02-01', '2030-02-03', '2026-09-30 10:00', '2026-09-30 10:15', repeat('a',64), repeat('b',64))`;
  accepts(hold);
  rejects(
    `${hold}; UPDATE "Hold" SET "status" = 'CONVERTED' WHERE "id" = '${uid(100)}'`,
    "Hold_token_contract_check",
  );
  rejects(
    `${hold}; UPDATE "Hold" SET "expiresAt" = "expiresAt" + interval '1 second' WHERE "id" = '${uid(100)}'`,
    "Hold_token_contract_check",
  );
  rejects(
    `${hold}; UPDATE "Hold" SET "clientKeyHash" = NULL WHERE "id" = '${uid(100)}'`,
    "Hold_token_contract_check",
  );
  rejects(
    `${hold}; UPDATE "Hold" SET "bookingDraftId" = '${uid(997)}' WHERE "id" = '${uid(100)}'`,
    "Hold_bookingDraftId_fkey",
  );
  accepts(
    `${hold}; UPDATE "Hold" SET "status" = 'CONVERTED', "bookingDraftId" = '${uid(10)}', "convertedAt" = now() WHERE "id" = '${uid(100)}'`,
  );
});

test("one new live VNPay attempt per booking; closed attempts permit replacements", () => {
  rejects(
    `${payment(20)}; ${payment(21)}`,
    "Payment_one_live_vnpay_attempt_key",
  );
  accepts(
    `${payment(20)}; UPDATE "Payment" SET "status" = 'SUPERSEDED' WHERE "id" = '${uid(20)}'; ${payment(21)}`,
  );
  rejects(
    `${payment(20)}; UPDATE "Payment" SET "amount" = 0 WHERE "id" = '${uid(20)}'`,
    "Payment_attempt_contract_check",
  );
});

test("capture identity deduplicates economic transactions and rejects cross-booking references", () => {
  rejects(
    `${payment(20)}; ${capture(30)}; ${capture(31, uid(10), "txn-30")}`,
    "PaymentCapture_provider_transaction_key",
  );
  rejects(
    `${payment(20)}; ${capture(30, uid(11))}`,
    "PaymentCapture_paymentId_bookingId_fkey",
  );
  accepts(
    `${payment(20)}; UPDATE "Payment" SET "status" = 'SUPERSEDED' WHERE "id" = '${uid(20)}'; ${capture(30)}`,
  );
});

test("refund obligations deduplicate by capture and cause and cannot allocate another booking capture", () => {
  rejects(
    `${payment(20)}; ${capture(30)}; ${refund(40)}; ${refund(41)}`,
    "Refund_captureId_reason_key",
  );
  rejects(
    `${payment(20)}; ${capture(30)}; ${refund(40, { bookingId: uid(11) })}`,
    "Refund_captureId_bookingId_fkey",
  );
  rejects(
    `${payment(20)}; ${capture(30)}; ${refund(40, { amount: "0.50" })}`,
    "Refund_vnd_check",
  );
});

test("uncertain refund executions prevent a second send until definitively resolved", () => {
  const setup = `${payment(20)}; ${capture(30)}; ${refund(40)}; ${execution(50, 1)}`;
  rejects(
    `${setup}; UPDATE "RefundAttempt" SET "status" = 'UNKNOWN'; ${execution(51, 2)}`,
    "RefundAttempt_one_unresolved_execution_key",
  );
  accepts(
    `${setup}; UPDATE "RefundAttempt" SET "status" = 'DEFINITIVELY_FAILED'; ${execution(51, 2)}`,
  );
});

test("terminal bookings cannot reopen through direct database updates", () => {
  for (const status of [
    "EXPIRED",
    "CANCELLED_BY_CUSTOMER",
    "CANCELLED_BY_STAFF",
    "CANCELLED_BY_ADMIN",
    "COMPLETED",
    "NO_SHOW",
  ]) {
    rejects(
      `${booking(100, { status })}; UPDATE "Booking" SET "status" = 'CONFIRMED' WHERE "id" = '${uid(100)}'`,
      "Booking_terminal_status_guard",
    );
    accepts(
      `${booking(100, { status })}; UPDATE "Booking" SET "paidAmount" = 1 WHERE "id" = '${uid(100)}'`,
    );
  }
});

test("refresh persistence requires a real unique successor and consumption evidence", () => {
  const token = (n) =>
    `INSERT INTO "RefreshToken" ("id", "userId", "tokenHash", "expiresAt") VALUES ('${uid(n)}', '${uid(1)}', 'hash-${n}', '2030-01-01')`;
  const setup = `${token(100)}; ${token(101)}; ${token(102)}`;
  accepts(
    `${setup}; UPDATE "RefreshToken" SET "replacedById" = '${uid(101)}', "revokedAt" = now(), "consumedAt" = now() WHERE "id" = '${uid(100)}'`,
  );
  rejects(
    `${setup}; UPDATE "RefreshToken" SET "replacedById" = '${uid(101)}' WHERE "id" IN ('${uid(100)}', '${uid(102)}')`,
    "RefreshToken_replacedById_key",
  );
  rejects(
    `${setup}; UPDATE "RefreshToken" SET "replacedById" = '${uid(997)}' WHERE "id" = '${uid(100)}'`,
    "RefreshToken_replacedById_fkey",
  );
  rejects(
    `${setup}; UPDATE "RefreshToken" SET "consumedAt" = now() WHERE "id" = '${uid(100)}'`,
    "RefreshToken_consumed_check",
  );
});

test("cancellation snapshots enforce exact 48/24-hour boundaries, aggregate rounding and actor/cause", () => {
  const cancellation = (
    at,
    rate,
    amount,
    cause = "CUSTOMER_CANCELLATION",
    actor = "CUSTOMER",
  ) => `
    INSERT INTO "BookingCancellation" ("id", "bookingId", "cause", "actorType", "actorUserId", "reason", "cancelledAt", "checkInAt", "policyVersion", "paidBasis", "refundPercent", "refundEntitlement", "currency")
    VALUES ('${uid(100)}', '${uid(11)}', '${cause}', '${actor}', '${uid(1)}', 'Fixture cancellation', '${at}', '2030-02-03T07:00:00Z', 'rental-v1', 1001, ${rate}, ${amount}, 'VND')`;
  for (const [at, percent, entitlement] of [
    ["2030-02-01T07:00:00Z", 100, 1001],
    ["2030-02-01T07:00:00.001Z", 50, 500],
    ["2030-02-02T07:00:00Z", 50, 500],
    ["2030-02-02T07:00:00.001Z", 0, 0],
  ]) {
    accepts(cancellation(at, percent, entitlement));
    rejects(
      cancellation(at, percent, entitlement + 1),
      "BookingCancellation_policy_check",
    );
  }
  accepts(
    cancellation(
      "2030-02-03T07:00:00Z",
      100,
      1001,
      "OPERATOR_CANCELLATION",
      "STAFF",
    ),
  );
  accepts(
    cancellation("2030-02-03T07:00:00Z", 100, 1001, "BOOKING_EXPIRY", "SYSTEM"),
  );
  rejects(
    cancellation("2030-02-03T07:00:00Z", 100, 1001, "OPERATOR_CANCELLATION"),
    "BookingCancellation_policy_check",
  );
  const one = cancellation("2030-02-01T07:00:00Z", 100, 1001);
  rejects(
    `${one}; ${one.replace(uid(100), uid(101))}`,
    "BookingCancellation_bookingId_key",
  );
});

test("webhook fingerprints and command keys deduplicate within their respective scopes", () => {
  const event = (
    n,
    merchant,
  ) => `INSERT INTO "PaymentWebhookEvent" ("id", "provider", "providerEventId", "payloadHash", "merchantId", "eventFingerprint", "status")
    VALUES ('${uid(n)}', 'VNPAY', 'event-${n}', repeat('a',64), '${merchant}', repeat('b',64), 'RECEIVED')`;
  rejects(
    `${event(100, "merchant")}; ${event(101, "merchant")}`,
    "PaymentWebhookEvent_scoped_fingerprint_key",
  );
  accepts(`${event(100, "merchant")}; ${event(101, "another-merchant")}`);
  const command = (
    n,
    scope,
  ) => `INSERT INTO "IdempotencyRecord" ("id", "scope", "keyHash", "requestHash")
    VALUES ('${uid(n)}', '${scope}', repeat('a',64), repeat('b',64))`;
  rejects(
    `${command(100, "customer:1:booking")}; ${command(101, "customer:1:booking")}`,
    "IdempotencyRecord_scope_keyHash_key",
  );
  accepts(
    `${command(100, "customer:1:booking")}; ${command(101, "customer:2:booking")}`,
  );
});

test("shared legacy refresh successors stop migration without changing their data or table", () => {
  sql(`CREATE SCHEMA rotation_guard;
    CREATE TABLE rotation_guard."RefreshToken" ("id" UUID PRIMARY KEY, "replacedById" UUID);
    INSERT INTO rotation_guard."RefreshToken" VALUES ('${uid(100)}', '${uid(102)}'), ('${uid(101)}', '${uid(102)}')`);
  const migration = readFileSync(
    join(
      root,
      "prisma/migrations/202609300001_refresh_rotation_foundation/migration.sql",
    ),
    "utf8",
  );
  rejects(
    `SET LOCAL search_path TO rotation_guard; ${migration}`,
    "Shared legacy refresh successors require review",
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM rotation_guard."RefreshToken" WHERE "replacedById" = '${uid(102)}'`,
    ),
    "2",
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM information_schema.columns WHERE table_schema = 'rotation_guard' AND column_name = 'consumedAt'`,
    ),
    "0",
  );
});
