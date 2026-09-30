# Rental lifecycle — Phase 2 persistence foundation

Scope recovered from `src/domain/rental/README.md`, particularly its minimum
additive Phase 2 proposal. Phase 1 was approved by the user and its files are
preserved. No saved AI-DLC intent or state record exists in this checkout.
This document records the continuation without inventing earlier decisions.

## Completion status

**Phase 2: COMPLETE — 2026-09-30.** Completion recorded at the user's explicit
request, based on the following user-reported validation results:

- `npm run typecheck`: PASS.
- `npm test`: PASS — 8/8 test suites and 71/71 tests passed.
- `npm run build`: PASS.
- Local database: `tt_rental` at `localhost:5432`.
- Both Phase 2 migrations are applied:
  `202609290001_rental_lifecycle_foundation` and
  `202609300001_refresh_rotation_foundation`.
- `prisma migrate status`: No pending migrations.

This completion update records the supplied results; validation was not rerun.
Work stops at Phase 2. Phase 3 is not started or authorized. No source code is
changed by this update, and no hold services, booking expiry, VNPay changes,
refund workers or controllers are implemented as part of it.

## Repository findings

On resumption, the working tree already contained the expanded Prisma schema,
`202609290001_rental_lifecycle_foundation`, `migration_lock.toml`, all Phase 1
domain files, and an `EXPIRED: []` compatibility entry in BookingStateService.
These existing changes were retained. The unrelated `.codex/config.toml` edit
and its backup were also retained.

All four pre-existing migrations, current models, booking/hold/payment services,
VNPay creation/IPN handling, authentication and eight existing test suites were
inspected before changes. Existing application paths still use legacy payment
and booking behavior. Schema support does not activate the new lifecycle.

## Phase 2 deliverables

| Area                  | Persistence supplied                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Holds and quotes      | Hashed capabilities and client keys; lifecycle timestamps; hold/quote/booking links                                               |
| Booking               | Nullable payment option, target, deadline, check-in instant/timezone, policy/pricing snapshot, confirmation and expiry timestamps |
| Payment attempts      | Existing Payment reused; explicit purpose, merchant, request evidence, supersession/expiry, reconciliation scheduling and leases  |
| Captures              | Separate charge evidence and applied amount; merchant-scoped economic transaction uniqueness; booking-consistent foreign keys     |
| Cancellation          | One decision per booking with actor, cause, reason, accepted time, paid basis and frozen entitlement                              |
| Refunds               | Per-capture obligations, deduplication, scheduling and separate provider execution identity/evidence                              |
| Webhooks and commands | Scoped event fingerprints/outcomes; command key and request hashes, result identity and optional encrypted response bytes         |
| Refresh rotation      | Existing replacedById reused as a unique self relation; nullable consumedAt and consumption evidence check                        |

The refresh addition is a separate migration,
`202609300001_refresh_rotation_foundation`. No existing migration was rewritten.
No token family table is needed for this foundation: User.tokenVersion already
provides the account-wide revocation version. Later auth code must enforce
same-user successors, immutable consumption and atomic rotation under locks.

SQL owns the partial indexes, CHECK constraints and terminal-booking trigger;
Prisma does not fully represent them. Preserve them in future migrations.
The original GiST occupancy exclusion and exclusive checkout interval remain.
Cross-row total refund capacity, concurrent accounting, authorization, immutable
policy snapshots and lock ordering still require later transaction adapters.
Neither a foreign key nor the row checks implement those transactions.

## Legacy rollout review

All new policy selectors on existing tables are nullable. NULL means unclassified
legacy data; it must not be interpreted as accepting the new policy. No backfill,
money conversion, reset, reseed, identity merge or live deployment was performed.

Run `scripts/rental-phase2-preflight.sql` through an explicitly selected database
connection before scheduling deployment. It uses a read-only transaction and
returns aggregate counts without customer contact values or token material.
It works both before and after schema expansion. Its execution in this session
is limited to synthetic fixtures; production counts remain unknown.

| Legacy cohort                                   | Rollout treatment before enabling later adapters                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing 30% deposits                           | Preserve agreed terms and balances. Keep on legacy processing until an explicit policy for these bookings is approved; never recalculate them as 50%.                                                    |
| Fractional or non-VND money                     | Preserve Decimal(12,2) values and currency. New-contract VND validation is opt-in, with no rounding or narrowing of old rows.                                                                            |
| Active tokenless holds                          | Keep their original expiry and availability effect. Do not manufacture proof or allow an arbitrary caller to claim them. Drain or explicitly resolve them before capability-based conversion is enabled. |
| Paid or cancelled bookings                      | Preserve history and terminal status. Reconcile provider evidence before creating capture/refund records; do not infer a charge from paidAmount alone.                                                   |
| Missing provider/merchant/transaction evidence  | Require provider reconciliation or human review. Do not invent transaction identifiers or issue refunds from guessed evidence.                                                                           |
| Multiple legacy live VNPay attempts             | Reconcile/drain them before enabling the new attempt path. The partial unique index covers only attempts with non-NULL purpose.                                                                          |
| Duplicate contact details or unlinked customers | Review ownership. Shared email/phone is a candidate for review, never permission to merge. Existing Customer.userId uniqueness remains.                                                                  |
| Dangling hold/refresh links                     | Preserve and report them. New FKs use NOT VALID to enforce new references without deleting history. Validate only after approved reconciliation.                                                         |
| Shared refresh successor                        | The new migration fails transactionally before changing the table. Review and resolve the history explicitly; never silently discard a predecessor.                                                      |

The terminal-booking trigger blocks reopening even through the legacy VNPay IPN
writer. A late callback may therefore receive its existing failure acknowledgment
until the later capture/refund adapter is implemented. This is a deliberate
database guard, not a complete late-payment workflow. Deployment review must
account for this behavior and outstanding provider callbacks.

## Verification and deployment boundary

`npm run test:migrations` requires PostgreSQL server tools (including btree_gist)
on PATH, or `PG_BIN` pointing to their directory. It creates a fresh temporary
cluster, disables TCP listening, applies the complete migration chain and stops
only its own server. It never reads the project DATABASE_URL. Temporary files
are retained for inspection. PostgreSQL 12+ is required by the existing enum
expansion; the local verification uses PostgreSQL 18.3.

The integration suite verifies legacy field preservation, schema/migration
agreement, original occupancy constraints, opt-in VND/deadline rules, hold proof
metadata, attempt/capture/refund uniqueness, cross-booking reference rejection,
terminal-state protection, refresh relationships and read-only preflight queries.
The existing Phase 1 and application tests remain separate and unchanged.

Verified on 2026-09-30: all 71 existing Jest tests and 15 PostgreSQL integration
tests pass. Prisma validate/generate, schema-to-database diff, TypeScript
typecheck, production build and `git diff --check` pass. Hash comparison confirms
the pre-existing Phase 1 files, all four earlier migrations, configuration files
and BookingStateService are unchanged by this continuation.

`npm run lint` reports 10 existing errors in the unchanged
`src/admin/admin.service.spec.ts` (untyped mocks and an async callback without
await). That unrelated test file was not modified.

Deployment is a separate operation: review aggregate preflight results, rehearse
against a restored database, plan for table/index locks, and then deploy the
reviewed migration chain. Both additions use a five-second lock timeout and
explicit transactions. The first migration commits its new enum values before
later transactions use them. If migration deployment fails, inspect its recorded
status and cause before retrying; do not reset the database or edit applied SQL.
For application rollback, retain the additive schema and disable the new writer;
do not drop history-bearing tables or columns.

Phase 2 ends at the persistence foundation and its verification. Phase 3 and
Phase 4 implementation is outside this continuation.
