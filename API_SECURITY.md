# API security and integrity — 07.11.2026

## Records and deletion
`GET /api/records` defaults to 50 results, accepts at most 100, and uses a stable created/id cursor scoped to owner and filters. Accepted filters are kind/carId/id/from/to; unknown/duplicate query fields and invalid cursors return 400. Queries always include owner. Migration 0001 supplies the pagination/filter indexes; 0004 adds the rate-limit expiry index. SQLite EXPLAIN and owner/cursor regression tests are retained.

Car deletion uses RESTRICT for dependent records and linked receipts: the API returns 409 and preserves the car and its dependents. After removal of dependencies, deletion revokes QR catalogs and photo metadata; R2 keys enter the cleanup outbox. It does not silently discard expenses/requests. Tests cover concurrent INSERT/DELETE, stale writes, documents, QR revocation, retries and cross-owner access. Existing legacy orphan files with no attributable metadata still need a separate storage audit.

## Common request boundary
All 32 exported handlers pass the native Request to `apiBoundary`. It applies persistent D1 rate limits before reading bodies or starting external work, then normalizes failures to `{code,message,requestId}` and emits a server-generated X-Request-Id. Storage failures in the limiter fail closed with 503. A test checks every handler's wiring, not just the helper in isolation.

Budgets per minute: authenticated reads 600, writes 300, uploads 30, account erasure 30, external lookup group 60. Expensive endpoints share one budget, so switching endpoints does not reset it. Station reviews stored in our DB use the read/write group. Fixed windows allow a burst across the minute boundary; this is not a WAF/DDoS service. A rejected request returns 429 with Retry-After and RateLimit headers. Health uses its existing read-probe cache; the separate secret-authenticated registry import is exempt from the session limiter.

Authenticated limits use a SHA-256 pseudonym of the platform subject; anonymous lookups use a hash of the Cloudflare-supplied CF-Connecting-IP, never X-Forwarded-For. Without edge metadata there is one shared anonymous budget. The edge must overwrite CF-Connecting-IP and identity headers: do not expose this Worker directly behind an untrusted proxy. Production spoofed oai-authenticated-user-* headers were checked to return 401. Self-hosting requires a trusted authentication gateway, not arbitrary client headers.

Counter expiry is two minutes from the bucket window; expired counters are physically purged in bounded batches on subsequent first requests. Owner erasure removes ordinary counters; its transient erasure budget remains to prevent clearing the limit by retrying deletion. No raw IP, VIN, email, request body, private URL or raw SQL exception goes into the limiter or API logs. SQL uses an atomic UPSERT with a cap, rather than a read-then-write counter, so separate Worker instances share the same limit.

Mutation checks require the fixed Site Origin, consistent Referer and same-origin Fetch Metadata when present; forwarded Host headers never authorize a write. JSON/multipart/gzip types and actual byte counts are checked. Both JSON and uploads have a total 15-second body deadline; trickling bytes do not reset it. Oversize cancellation does not await a hostile stream. Slow requests return typed 408, oversized ones 413. The authenticated gzip import has the same deadline and its own 2 MB bound. External fetch adapters retain bounded AbortSignal deadlines; writes are not raced against a fake timeout that might report failure while silently committing later.

Runtime SQL errors are mapped only through our explicit constraint codes; API logs include route/status/code/requestId and do not serialize the exception. Provider/GC background warnings contain fixed event names without identifiers. Native platform log retention is outside Motorna's record erasure API.

## Account erasure
See DATA_LIFECYCLE.md. Server deletion remains owner-scoped, explicitly confirmed and idempotent. The browser automatically continues 202 file batches, honors 429 backoff, and stops on repeated storage failure instead of claiming completion. Reloading a pending account exposes the continuation state. It still requires the browser to remain open or a later resume; a guaranteed background scheduler is not configured. The permanent technical tombstone is explicitly disclosed and prevents late writes from recreating data; it retains a subject identifier, so this is not a claim of zero retained personal identifiers.

## Operational scope
Cloudflare D1/R2 backup/restore was explicitly deferred by the owner in this iteration; it is not configured or marked verified. Telegram alerts remain disabled by the owner's earlier instruction. Neither successful builds nor saved source versions count as a data backup.
