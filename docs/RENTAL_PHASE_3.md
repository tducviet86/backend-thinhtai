# Rental lifecycle — Phase 3 integration

## Status and boundary

Phase 2 was reviewed and approved by the user on 2026-09-30. Phase 3 is
authorized; Phase 4 is not. Existing migrations and historical commercial data
must be preserved. No deployment, production access, database reset or
destructive seed is authorized.

Pre-implementation inspection is complete. The exact Phase 3/4 boundary is
awaiting clarification: no numbered implementation plan exists in this checkout.
The Phase 1 README assigns hold caps and trusted-proxy configuration to Phase 3,
the foundation migration assigns VNPay attempt integration to Phase 5, and the
README assigns read-permission integration to Phase 7. Those references must not
be interpreted as authorization to implement every remaining contract in Phase 3.

## Inspected foundation

- All four Phase 1 contract modules: states, money, policies and authorization.
- Phase 2 Prisma models, both additive migrations, SQL checks, partial unique
  indexes, terminal-state trigger and the original GiST occupancy exclusion.
- Booking creation and state service; public booking/hold DTOs and controller.
- Pricing, availability, admin booking/payment/status/block operations.
- VNPay request, return and IPN handling; the separate manual payment controller.
- Registration, profile synchronization, refresh rotation, app throttling and
  environment/proxy configuration.

## Legacy conflicts identified before coding

| Location | Existing behavior | Approved contract / integration requirement |
| --- | --- | --- |
| `BookingsService.createHold` | Creates tokenless holds without client identity, proof, cap or command deduplication. Globally expires holds under only one unit lock, using process time. | Store hashed random bearer capabilities and client identities; enforce caps under a client lock before the unit lock; use database time after locking and exact original 15-minute expiry. |
| `BookingsService.create` | Reprices outside the transaction; no hold proof/conversion or retained quote relation; its own active hold blocks checkout. Creates bookings without the new policy fields or payment option. | Validate a matching quote and proven hold in the transaction; atomically insert booking and convert only that hold; persist immutable payment target, 30-minute deadline and frozen policy/check-in/pricing context. |
| `PricingService.quote` | Uses configurable legacy deposit rate; fractional fees/discounts are possible; promotion identity is not persisted; all active holds block pricing. | New-policy values must be integer VND with floor(total / 2) deposit, retained promotion/pricing context and proof-aware hold handling. Preserve existing quoted/contracted legacy terms. |
| `AvailabilityService` | Uses process time, never expires pending bookings, and has no verified-hold exclusion. | Expire eligible stale reservations under the unit lock before insertion; ignore only the verified converting hold; retain exclusive checkout intervals and the GiST exclusion. |
| Reservation transactions | Serializable writes have no bounded whole-transaction retries. | Retry serialization/deadlock failures with a bounded policy and preserve command identity. |
| `AdminService.createBooking`, `transition`, `block` | Separate legacy reservation writers; state transitions read before locking and lack actor-aware domain checks. | Account for every competing writer and maintain a consistent lock order. New-flow confirmation belongs to the payment processor; cancellation requires a frozen decision. |
| `VnpayService.createPaymentUrl` | Deposit-only amount, renewable process-time expiry, cancels previous attempts, lacks booking lock and new attempt metadata. | Selected target outstanding, immutable booking deadline, durable request evidence and serialized supersession. Foundation explicitly identifies this work with Phase 5. |
| `VnpayService.handleIpn` | Reads mutable payment/booking before transaction; can pay inactive attempts; sums attempts instead of captures; no deadline check, durable late-charge refund obligation or economic-capture deduplication. | Serialize on booking; atomically record verified capture, application/refund obligation and event outcome without reopening terminal state. |
| Manual payment paths | `PaymentsController` uses JS-number money and aggregates paid rows; `AdminService.payment` records receipts without captures or domain confirmation. | Exact money and evidence-backed accounting through the payment-processor boundary; no overpayment or deadline bypass. |
| `BookingStateService` | Legacy state graph allows PAYMENT_FAILED and actor-free confirmation; lacks pending-to-expired edge. | Apply Phase 1 actor-aware transitions to new-policy rows while preserving explicitly classified legacy behavior. |
| Auth | Registration already creates User/Customer atomically. Profile email sync is a second write. Refresh creates a successor before separately revoking predecessor and does not populate rotation links. | Preserve canonical Customer.userId identity; atomic profile synchronization; lock User then token and consume/create exactly one successor atomically. |
| Public/admin reads | Public booking lookup exposes financial fields; combined admin read paths have broader payloads than Phase 1 read scopes. | Explicit serializers/selects and independent read permissions; Phase 1 assigns this integration to Phase 7. |
| HTTP configuration | Global per-process throttling exists, but no hold-specific cap/rate policy or explicit trusted-proxy setting. | Configure hold abuse controls and trusted proxies; IP addresses must not become anonymous client identity. |

## Baseline validation

Before implementation on 2026-09-30:

- `npm run typecheck`: PASS.
- `npm test`: PASS — 8/8 suites, 71/71 tests.
- `npm run build`: PASS.

These results establish the unchanged-source baseline, not Phase 3 completion.
No schema or migration changes have been made. Read-only `prisma migrate status`
against `tt_rental` at `localhost:5432` reports five migrations and an up-to-date
database schema (no pending migrations).
