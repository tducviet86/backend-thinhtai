# Admin integration test results

Environment: isolated local PostgreSQL + NestJS API.

Run: 2026-09-21T08:36:39.706Z

- PASS: Unauthenticated admin API is rejected
- PASS: Incorrect password is rejected
- PASS: Admin login and permission session
- PASS: Customer account cannot use admin session
- PASS: List dashboard, customers, catalog, calendar, payment and audit
- PASS: Create property
- PASS: Edit property and validate invalid coordinates
- PASS: Create apartment with fees and deposit
- PASS: Duplicate apartment code rejected
- PASS: Create customer
- PASS: Update customer and clear optional email / note
- PASS: Reject blank name and malformed email
- PASS: Reject invalid stay dates / capacity / extra fields
- PASS: Authoritative quote includes fees and required deposit
- PASS: Reject stale quote after price change
- PASS: Create booking from valid quote
- PASS: Prevent overlapping booking / maintenance
- PASS: Allow adjacent stay starting on checkout day
- PASS: Cannot confirm before deposit
- PASS: Cannot skip directly to check-in
- PASS: Reject negative and excessive payment
- PASS: Deposit payment is idempotent
- PASS: Confirm after deposit and check in
- PASS: Cannot check out before balance is paid
- PASS: Collect balance, check out, complete
- PASS: Completed booking cannot be changed or paid again
- PASS: Block and unblock room
- PASS: Draft apartment cannot be booked
- PASS: Create custom role and reject duplicate / invalid permissions
- PASS: Create staff and authenticate with scoped permissions
- PASS: Staff cannot access financials, staff list, customer list or mutate
- PASS: Protected owner and self cannot be reassigned
- PASS: Changing role revokes old token and refresh
- PASS: Disabling staff revokes session and prevents login
- PASS: Invalid IDs and missing entities return meaningful errors
- PASS: Concurrent double booking allows only one winner
- PASS: Concurrent payment requests never double-count the same receipt
- PASS: Audit contains all important mutations
