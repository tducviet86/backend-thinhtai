# Rental domain contracts — Phase 1

Authority: the approved design and final business rules in this conversation.
These pure contracts and tests are not wired into controllers, Prisma writes,
VNPay callbacks, workers, or guards yet. Existing API behavior is unchanged.
Do not treat this phase as fixing the previously audited live-flow defects.
No schema, migration, generated client, seed, or database changes belong here.

## Contract files

- `states.ts`: domain state unions (independent of generated Prisma enums), actor
  restrictions, terminal states and transition assertions.
- `money.ts`: integer VND, Decimal arithmetic, chosen payment targets, refund capacity.
- `policies.ts`: exact deadlines, confirmation eligibility, refund entitlement.
- `authorization.ts`: separate read permissions and the public response shape.
- Adjacent specs: executable examples and rejection/boundary tests.

## Money and time invariants

Only VND is supported in the new contract. Inputs are decimal strings or Decimal
objects; JavaScript numbers are rejected. Values must be finite, non-negative,
integer VND within existing Decimal(12,2) storage capacity (9,999,999,999 VND).
The private Decimal constructor uses independent precision; no global Decimal
configuration is modified. No monetary arithmetic uses floating point.

Deposit = floor(total / 2). The same floor rule applies to a 50% customer refund.
FULL_100 requires the total; DEPOSIT_50 requires the deposit. Pending partial
payments do not extend deadlines. Remaining = total - applied payments; applied
payments may not exceed total. Required outstanding = max(target - applied, 0).
An unwanted provider capture is not an applied payment: record it separately and
create a full refund obligation in later phases, rather than hiding overpayment.

The 1 VND deposit case intentionally computes 0 VND, not an invented minimum.
Before checkout wiring, define a zero-charge fulfillment path or a minimum
bookable total; never issue a zero-value VNPay request. Zero-value calculations
are supported, but the phase does not silently change catalog pricing policy.

Hold expiry = original creation instant + exactly 15 minutes.
Pending booking deadline = original creation instant + exactly 30 minutes.
Equality at a deadline is expired. Helpers require explicit valid instants and
never call Date.now. Later adapters must use database time read after locking,
not process time, transaction-start time before lock waits, or provider pay time.
Creation instants/deadlines cannot be refreshed by retries or replacement attempts.

Confirmation eligibility requires PENDING_PAYMENT, validation before the deadline,
and the selected target reached. All successful application and confirmation
changes must commit atomically in later phases. Date comparisons use timestamps;
monetary calculations use Decimal. Frozen check-in instants include the property's
local check-in time in Asia/Ho_Chi_Minh, not midnight of its database DATE column.

## State machines and required contextual validation

`assert*Transition` checks the edge and actor, not all business context. Never
call it as a substitute for authentication, permission, ownership, proof,
accounting, or provider validation. Replayed commands return recorded results;
they do not execute same-state transitions. Initialization is separate from transitions:
holds start ACTIVE, bookings PENDING_PAYMENT, attempts PENDING, refunds REQUESTED.

| Entity  | Allowed edges                                                                       | Context required before applying                                                                                       |
| ------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Hold    | ACTIVE → CONVERTED/CANCELLED/EXPIRED                                                | Verified bearer proof for holder actions; expiry clock; matching stay/quote; atomic booking association                |
| Booking | PENDING_PAYMENT → CONFIRMED/EXPIRED/customer-staff-admin cancellation               | Selected target and deadline for confirmation; true elapsed deadline for expiry; valid cancellation actor/cause/reason |
| Booking | CONFIRMED → CHECKED_IN/NO_SHOW/cancellation                                         | Action permission, check-in/no-show policy, cancellation snapshot                                                      |
| Booking | CHECKED_IN → CHECKED_OUT → COMPLETED                                                | Checkout requires full payment; no state skipping                                                                      |
| Attempt | PENDING → PROCESSING; PENDING/PROCESSING → PAID/FAILED/SUPERSEDED/EXPIRED/CANCELLED | Verified outcome, exact amount/reference/merchant, live attempt, eligible locked booking                               |
| Refund  | REQUESTED → PROCESSING; unresolved states → MANUAL_REVIEW                           | Durable entitlement, claim/lease, capacity not already allocated                                                       |
| Refund  | PROCESSING → PENDING_PROVIDER/SUCCEEDED/RETRYABLE_FAILED                            | Verified settlement or definitive no-transfer evidence; a timeout is uncertainty                                       |
| Refund  | PENDING_PROVIDER → SUCCEEDED/RETRYABLE_FAILED                                       | Reconciliation evidence, never blind resubmission                                                                      |
| Refund  | RETRYABLE_FAILED → PROCESSING                                                       | Safe retry only                                                                                                        |
| Refund  | MANUAL_REVIEW → PENDING_PROVIDER/SUCCEEDED/RETRYABLE_FAILED                         | Evidence-backed resolution by refund service                                                                           |

Terminal bookings: EXPIRED, all three cancellation states, COMPLETED, NO_SHOW.
No actor can reopen them. Legacy DRAFT/PAYMENT_FAILED booking rows require an
explicit migration policy and are not new-flow states. Existing state service
and its legacy tests remain untouched until booking integration.

PAID/FAILED/SUPERSEDED/EXPIRED/CANCELLED attempts cannot reopen. An inactive
attempt receiving a newly verified charge stays inactive: preserve a separate
capture with REFUND_REQUIRED disposition. A repeated notification for a capture
already applied before cancellation is a duplicate, not a new late charge.
Refund completion never changes booking fulfillment state.

Only the PAYMENT_PROCESSOR boundary confirms bookings (including application of
verified manual receipts). Staff cannot directly force confirmation. Only the
REFUND_WORKER boundary settles refunds; staff may request reconciliation, not
assert an unevidenced settlement.

## Cancellation and refund invariants

Refund calculation takes actual paid money, not booking total. At cancellation:

| Cause                                              | Entitlement                 |
| -------------------------------------------------- | --------------------------- |
| Customer, at least 48 hours before frozen check-in | 100% of actual paid         |
| Customer, at least 24 but less than 48 hours       | floor(actual paid / 2)      |
| Customer, less than 24 hours                       | 0                           |
| Operational/property cancellation by staff/admin   | 100%                        |
| Automatic booking expiry                           | 100% of all collected money |
| Newly observed late or superseded capture          | 100% of that capture        |

Cause is distinct from actor: staff acting on a customer's cancellation request
must not silently classify it as a property-caused cancellation, or vice versa.
Persist actor, reason, cause, actual accepted cancellation timestamp, frozen
check-in instant, policy version, paid basis, rate and entitlement together.
Retries reuse that decision instead of recalculating after a cutoff.

Outstanding entitlement subtracts completed refunds and already-reserved
obligations. Both consume refundable capacity. Cross-capture allocation must
floor the aggregate entitlement once and distribute whole VND deterministically;
flooring each capture separately could under-refund. Duplicate callbacks and
refund requests must not create duplicate obligations.

This phase calculates amounts only. It does not implement capture, refund
allocation/persistence, provider instructions, API acknowledgments or workers.
VNPay rejection is not a reversal of money: a late verified charge must be
recorded, durably assigned a refund obligation, and acknowledged according to
the provider contract. An ambiguous refund response requires reconciliation.

## Authorization and identity contracts

| Information/action                           | Required boundary                                          |
| -------------------------------------------- | ---------------------------------------------------------- |
| Public booking lookup                        | Explicit public DTO only                                   |
| Booking operations                           | booking.read                                               |
| Booking-linked customer information          | booking.read + customer.read                               |
| Booking-linked payment/financial information | booking.read + payment.read                                |
| Internal audit                               | audit.read (proposed new permission)                       |
| Customer self-service                        | Canonical Customer.userId equals authenticated User.id     |
| Payment confirmation/refund command          | Separate action permission; does not imply read permission |

Public fields are only bookingCode, status, checkIn, checkOut, guestCount, and
unit.publicCode/nameVi/nameEn. Never spread a database entity into a public DTO.
TypeScript types alone do not strip extra runtime fields; Phase 7 must implement
explicit Prisma selects and serializers, including dashboard/calendar paths.

Registration must create/link User and Customer atomically. Reuse a registered
user's unique linked Customer. Never merge unrelated contacts based on matching
email/phone. Linked profile updates synchronize account names/email in one
transaction; phone/nationality belong to Customer. Preserve historical records.
The existing unique Customer.userId is reusable; do not invent duplicate identity
tables. Legacy linkage must be reviewed before adding stricter constraints.

## Future transaction and idempotency obligations

No concurrency guarantee is provided by a pure function. Later adapters must:

1. Use serializable transactions and bounded whole-transaction retries.
2. Lock in one order: idempotency command → unit advisory lock → booking → hold
   → attempt → capture → refund; sort IDs when locking several of one kind.
3. Under the unit lock, expire stale pending bookings/holds before reservation
   insertion; retain the existing GiST booking exclusion constraint.
4. Convert a proven, matching hold and insert its booking in one transaction;
   exclude only that verified hold from conflict checking. Never release first.
5. Serialize payment application, expiry and cancellation on the same booking;
   use clock time after lock acquisition and revalidate all mutable state.
6. Commit capture/application/refund obligation/event decision together. Unique
   economic transaction IDs and obligation keys provide durable deduplication.
7. Persist refund commands before external calls; no network calls inside DB
   transactions. Timeouts/crashes after sending require reconciliation before retry.
8. Lock User then refresh token, consume the predecessor and create one successor
   atomically; never issue multiple successors under concurrent refresh.

Anonymous client identity must be a server-issued opaque random capability,
not device fingerprinting or IP-derived identity. Hash stored capabilities,
redact headers, rate-limit creation, and enforce a configured active-hold cap
under a client-level lock BEFORE the unit lock. All capped hold-creation paths
must use that ordering. Cap values and trusted-proxy configuration belong to
Phase 3. Expired holds do not count; resets of anonymous cookies cannot be fully
prevented without stronger identity, so rate limits remain necessary.

## Minimum additive Phase 2 proposal — not implemented

Retain existing models, Decimal columns, foreign keys and migration history.
Do not narrow/round legacy money or reset/reseed data.

| Area                | Minimum additions to support later phases                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hold                | Token hash (unique), opaque client hash/index, converted/released timestamps; unique booking-to-hold FK                                                                  |
| Booking             | EXPIRED enum, payment option/target, immutable payment deadline, frozen check-in instant/timezone/policy snapshot, expiry/confirmation timestamps; status/deadline index |
| Quote               | Hold relation and retained pricing/promotion context; unique booking-to-quote relation                                                                                   |
| Attempt             | SUPERSEDED/EXPIRED states, expiry and supersession metadata, merchant/provider creation timestamp, immutable request data; one live attempt per booking partial index    |
| Capture             | Separate successful-charge record, applied amount/disposition; unique provider+merchant+transaction ID                                                                   |
| Cancellation        | Unique booking decision snapshot, actor/cause/reason/time/paid basis/rate/entitlement                                                                                    |
| Refund              | Capture allocation, cause, amount/state, deduplication key, execution scheduling/lease fields                                                                            |
| Refund attempt      | Unique provider request identity and request/outcome evidence for uncertain external execution                                                                           |
| Webhook/idempotency | Fingerprinted events with processing outcome; command key+payload hash+result identity                                                                                   |
| Refresh token       | Consumed timestamp and unique successor relation; family/version metadata if required for revocation                                                                     |

Introduce nullable/additive fields first, classify legacy rows, then review
backfill and constraints. New-policy integer-VND checks must not silently reject
or mutate existing fractional/non-VND historical rows. Existing customer linkage
constraints are retained; mandatory registered-customer consistency can be
strengthened only after legacy review. Worker scheduling can use refund/attempt
tables; a new queue package is not required by this proposal.

Phase 2 must separately review rollout of existing 30% deposit bookings, active
tokenless holds, paid/cancelled records, missing provider evidence and duplicate
identity candidates. No such data is inspected or changed by the unit tests.
