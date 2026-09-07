# TT Rental backend

Production-oriented NestJS/PostgreSQL API for an operator-owned apartment inventory. It includes strict DTO validation, JWT rotation, permission-based authorization, catalog projections, authoritative availability and pricing, concurrency-safe booking creation, independent payment history, centralized SEO resolution, sitemap filtering, redirects, structured data, request IDs, throttling, health checks, and Swagger in non-production.

## Start locally

1. Copy `.env.example` to `.env` and replace both JWT secrets.
2. Start PostgreSQL and create the configured database.
3. Run `npm install` and `npx prisma generate`.
4. Run `npx prisma migrate deploy`.
5. Optionally set `ADMIN_EMAIL` and a 12+ character `ADMIN_PASSWORD`, then run `npm run prisma:seed`.
6. Run `npm run start:dev`. Swagger is at `/docs` outside production.

## Key endpoints

- `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`
- `GET /api/v1/locations`, `/properties`, `/units`
- `GET /api/v1/availability`
- `POST /api/v1/pricing/quote`
- `POST /api/v1/bookings/holds`, `POST /api/v1/bookings`
- `GET /api/v1/bookings/:bookingCode`
- `POST /api/v1/admin/bookings/:bookingId/payments`
- `GET /api/v1/seo/resolve`, `GET /api/v1/sitemap/:type`
- `GET /api/v1/admin/seo/audit`, `PATCH /api/v1/admin/seo/pages/:id/path`
- `GET /api/v1/health/live`, `GET /api/v1/health/ready`

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for concurrency and domain decisions.

## Intentional next slices

The schema anticipates CMS, review moderation, manual booking price overrides, room-change/extension history, webhooks, and media storage, but their complete admin CRUD/workflows are not exposed yet. Redis is intentionally not required for correctness; introduce it behind catalog/SEO cache interfaces when operational load justifies it. A production gateway integration must implement provider-specific signature verification and idempotent webhook processing before accepting online payment callbacks.
# backend-thinhtai
