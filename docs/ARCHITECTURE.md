# Architecture and operational notes

The API uses Nest modules at the HTTP/application boundary and Prisma as the persistence layer. Controllers only validate/translate HTTP. `AvailabilityService`, `PricingService`, `BookingStateService`, and `StructuredDataService` are the authoritative domain services.

## Booking concurrency

All stay intervals are `[checkIn, checkOut)`. Booking mutations run in serializable transactions and acquire `pg_advisory_xact_lock(hashtextextended(unitId, 0))` before checking conflicts. The migration additionally adds a PostgreSQL GiST exclusion constraint over `unitId` and `daterange(checkIn, checkOut, '[)')` for occupying statuses. The constraint is the final invariant even if a future code path omits the advisory lock.

Expired holds are ignored immediately by backend queries and opportunistically marked `EXPIRED`. Production should also schedule a small worker to batch-update expired rows for housekeeping; correctness does not depend on that worker.

## Boundaries

Public projections never return `Unit.internalCode`. Prices are recalculated on booking creation. Payment rows are immutable history; browser redirects are not payment confirmation. SEO publication and availability status remain independent.

Object storage and Redis are deliberately abstractions/operational integrations rather than correctness dependencies. Media stores stable keys and URLs; connect the chosen S3-compatible provider before enabling uploads. Add Redis only for catalog/SEO cache entries with explicit mutation invalidation.
