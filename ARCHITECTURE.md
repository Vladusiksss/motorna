# Motorna domain architecture

## Boundaries

- `app/modules/vin/service.ts`: VIN validation, registry/provider resolution, seven-day shared specification cache. `app/vpic.ts` is the backwards-compatible entry point. Provider enrichment never constitutes OEM fitment evidence.
- `app/modules/catalog/service.ts`: owner/car/VIN scoped offer searches, leases, cache freshness and fitment labeling. HTTP concerns stay in `api/web-parts`.
- `app/modules/garage/service.ts`: owned-car lookup and vehicle query composition. General record persistence/atomic parent constraints remain in `api/records` and SQL triggers; this is not a separate microservice.
- `app/modules/diagnostics`: conversation rules and request contract. This is the existing deterministic symptom analyzer, not a newly connected LLM.
- `app/modules/requests/contracts.ts`: purchase-line and draft validation; `validation.ts` preserves existing record API names. Draft composition remains the independently tested `purchase-model.ts`.
- `app/modules/shared/contracts.ts`: inferred query DTOs, exact calendar dates, ISO timestamps, HTTPS URLs without embedded credentials, supported currencies and integer minor-unit money.
- `app/modules/integrations/offer-adapter.ts`: injectable source interface and actual public-product-page adapter. Capability flags explicitly distinguish article matching from VIN fitment. Existing allowlists, timeouts and source extraction stay in `product-offers.ts`. Photo sources retain their specialized typed contracts and license/provenance policies under `vehicle-intelligence`.

## Cache and jobs

VIN cache: seven days, expired entries removed on writes, registry results cached too. Migration 0006 adopts the pre-existing runtime-created VIN table without dropping rows. HTTP handlers no longer create this table.

Offer cache: five minutes fresh, up to thirty minutes retained. Key includes owner, car ID, VIN, query and adapter ID; the key is SHA-256, the actual owner is stored for cleanup. Reusing stale data returns `cache.status=refreshing` and starts a background update; original `checkedAt` is preserved. First lookup returns HTTP 202/Retry-After 2; the client polls with cancellation and a finite timeout. Cached successful responses are HTTP 200/private/no-store.

D1 `catalog_search_jobs` gives a sixty-second atomic lease across Worker instances. Completion must still own the lease and the same parent VIN. Failed searches have a short cooldown and return the existing safe 503 envelope on the next poll. Jobs older than a day are collected after successful work. This is request-driven recovery, not an autonomous durable queue: Cloudflare waitUntil extends the Worker lifecycle; an interrupted job is retried by a later user request. Photo jobs use the same lifecycle helper and retain their existing durable search state/budgets.

The heavy CSV import remains outside HTTP in `backend/import_mvs.py`. The protected registry upload endpoint only accepts a bounded already-prepared gzip shard and writes it to R2. Periodic imports, unconditional background price polling, Cloudflare Queues/cron consumers and unattended retries are **not configured**. They require a hosting-supported scheduler/queue binding; no such binding has been invented in the manifest.

## Integrity and migrations

0005 adds offer-cache indexes for owner/car cleanup and expiry. 0006 adds job lease/owner indexes, adopts the VIN table, and installs SQL parent/erasure guards. Deleting or changing a car invalidates its cached offers and jobs. Account erasure removes both; late jobs cannot recreate them. Existing record pagination indexes and dependency restrictions remain unchanged.

Schema changes go through `npm run db:generate`; review generated SQL and snapshots together. Handwritten triggers are intentionally part of the migration. Sites applies checked-in migrations before deploying the Worker. Never edit an already-deployed migration. `tests/architecture.mjs` rehearses both clean installation and adoption of an existing VIN cache using SQLite, tests lease deduplication, stale refresh, minor-unit normalization, and VIN/deletion/erasure races. It does not substitute for a D1/R2 backup/restore exercise (deferred by the owner).

## Data compatibility

New adapter output adds `money: {amountMinor,currency}` when the source price has an exact supported two-decimal representation; otherwise money is null. Existing `price`/`currency` wire fields remain for the deployed UI and stored drafts. Historical financial backfill is still the separately prepared migration and has not been activated. No implicit currency conversion or rounding is introduced.

## Checks

`npm run lint:strict`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Merchant/VIN upstream fixtures in browser tests are explicitly mocked; real public sources are not guaranteed available by passing CI.

## Related operational contracts

Authorization, Origin/CSRF, streaming body limits, request IDs and rate limiting: [API_SECURITY.md](API_SECURITY.md). Record pagination/export: `app/record-query.ts` and `tests/records-pagination.mjs`. Personal-data deletion and retained technical tombstone: [DATA_LIFECYCLE.md](DATA_LIFECYCLE.md). Financial migration/rollback: [MONEY_MIGRATION.md](MONEY_MIGRATION.md). Release evidence and remaining external dependencies: [RELEASE.md](RELEASE.md).
