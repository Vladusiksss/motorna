# VIN Intelligence & Vehicle Photo Search

Implemented in the existing Next/Vinext application, D1 (`DB`) and R2 (`BUCKET`). No second vehicle store or replacement authentication system. Reviewed provider documentation on 2026-11-07.

## User journey

1. Existing `/api/vehicle` validates and decodes VIN through Motorna's registry/vPIC/free enrichment chain. Available fields and provenance are retained in the existing `records` car payload. Unknown characteristics remain unknown; a VIN cannot universally reveal colour, options or every factory specification.
2. Confirming a vehicle saves it in the garage. Repeating a create for the same owner and nonempty VIN returns the existing record. Existing duplicate records are not silently merged or deleted. An empty VIN is not a dedupe key.
3. On opening the saved vehicle, the gallery starts a bounded background lookup and polls its status. The home card and garage share the same component and persisted state.
4. Photos are separated into **exact source VIN**, **model illustrations** and **private owner uploads**. Each source result retains provenance, evidence, retrieval date, licence and expiry. Listing publication date is shown only when actually supplied.
5. Select a primary image, hide all external images, refresh when the cache permits, remove an individual image, or clear external search results. Owned images survive clearing search results. Uploaded images are never added automatically to the anonymous QR catalogue.

## Match evidence

`EXACT_VIN_MATCH`: the response explicitly identifies the requested VIN. This verifies the source's identifier, **not the authenticity, current condition or ownership of the photographed vehicle**.

`MODEL_MATCH`: an illustration, not a confirmed photograph of this VIN. Commons matching uses existing make/model/year/body/colour helpers and rejects explicitly rear/interior images. The reviewed Audi image explicitly documents its generation and unconfirmed photographed model year. Auto.dev's documented `/photos/{vin}` response supplies URL strings without repeating the VIN; Motorna deliberately treats those results as illustrative, with `vin_endpoint_without_echo` evidence.

`CONFLICT`: source VIN differs; no images enter the gallery. `NO_MATCH`: no source identification. Owner uploads use `NO_MATCH` and `owner_upload_not_vin_proof`, never a false verified badge.

## Provider configuration (server secrets only)

All commercial providers default **off**. No production fixtures or hidden free scraping fallback. A key alone is insufficient: the operator must have permission both to display the imagery and retain its metadata under the applicable contract.

| Provider | Implemented access | Activation |
| --- | --- | --- |
| NHTSA vPIC / existing Motorna sources | Existing decoding chain reused | No new key; partial coverage outside US-market vehicles remains possible |
| Wikimedia Commons | Documented MediaWiki API, licensed model illustrations with attribution | Enabled by default; `VEHICLE_COMMONS_ENABLED=false` disables new lookups |
| Auto.dev | `GET https://api.auto.dev/photos/{vin}`, Bearer authentication, validated `data.retail` response | Variables below plus permitted image CDN hosts |
| Vehicles.dev | `GET https://api.vehicles.dev/v1/vehicles/photos/{vin}`, Bearer authentication; explicit source VIN and listing URL | Variables below **and independent image display permission** |
| AUTO.RIA | Configuration status `agreement_required`; no network adapter activated | Agree permitted VIN search, listing/photo access and attribution with RIA before implementing its contracted search flow |
| Copart / IAA | Configuration status `agreement_required`; no invented API endpoint | Official or licensed-aggregator contract and documented response schema required |

For either implemented commercial adapter, set `<PREFIX>` to `AUTO_DEV` or `VEHICLES_DEV`:

```text
<PREFIX>_ENABLED=true
<PREFIX>_API_KEY=<Cloudflare/Sites server secret>
<PREFIX>_PHOTO_RIGHTS_CONFIRMED=true
<PREFIX>_IMAGE_HOSTS=<comma-separated permitted image CDN hostnames>
<PREFIX>_TTL_SECONDS=3600
VEHICLE_PHOTO_DAILY_CALL_LIMIT=20
VEHICLE_COMMONS_ENABLED=true
```

Do not put these secrets in client `NEXT_PUBLIC_*` variables, Git, chat, URLs or uploaded archives. Keep `_ENABLED=false` until rights, metadata retention and tariff are confirmed. `_IMAGE_HOSTS` is an explicit CDN allowlist, not an arbitrary API base URL. Signed/query-string image URLs are conservatively rejected by this version; do not strip a signature to bypass a provider requirement. No server-side fetch or mirroring of external image bytes occurs.

Limits: 30 search starts per owner per UTC day; at most 20 commercial attempts per owner per day; global commercial attempt cap defaults to 20/day and is configurable up to 1,000. The global limit includes **both providers and retries**, so it is a call budget rather than a monetary guarantee. Two simultaneous requests cannot claim the same running vehicle job. Budget reservation is atomic SQL; a failed attempt still uses a reservation. Native provider account caps should also be enabled. Uploaded files are limited to 5 MB, JPEG/PNG with content markers and bounded dimensions (40 MP, 12,000 px per side), 20 images per vehicle, 50 upload attempts per owner per UTC day. This checks structure and dimensions, not malware or authenticity. Original EXIF may remain; images stay owner-private.

### Documentation, tariffs and rights

- [vPIC documentation](https://vpic.nhtsa.dot.gov/api/): public identification data; no OEM fitment confirmation.
- [Auto.dev photo contract](https://docs.auto.dev/v2/reference/getVehiclePhotos), [pricing](https://www.auto.dev/pricing), [terms](https://www.auto.dev/terms): current free plan has a capped monthly allowance; paid tiers add usage charges. Availability and legal photo use must be checked for the subscribed account, not inferred from the existence of an image URL.
- [Vehicles.dev documentation and usage terms](https://vehicles.dev/docs): paid server API with a one-time Starter allowance; photo URLs belong to marketplace CDNs and **Vehicles.dev does not sublicense the imagery**. Obtain permission from the relevant rights holder before enabling image display.
- [RIA developer documentation](https://developers.ria.com/docs/) and [official repository](https://github.com/ria-com/auto-ria-rest-api): API key, access packages and service attribution apply. A documented photo-by-advertisement-ID method is not proof of unrestricted exact-VIN search or image redistribution rights.
- [MediaWiki Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo), [Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia): author, licence and source remain visible. A model illustration is not a specific VIN photo.

Tariffs can change. No registration, purchase, trial activation, supplier message or external account change was performed by this implementation.

## API

Existing `/api/vehicle` remains the decoding entry point. Existing `/api/vin-photos` is retained for legacy previews but returns `save_vehicle_required` with no photos; it no longer scrapes listings. `/api/vehicle-image` now uses the documented Commons provider only. Old HTML extraction helpers are not in the active photo lookup pipeline.

All new `/api/vehicle-photos` operations require the current signed-in owner of `carId`. Mutations use the existing strict Origin/Fetch Metadata checks; JSON is read through the bounded streaming helper. Errors use the existing `{code,message,requestId}` boundary.

| Method | Input | Result |
| --- | --- | --- |
| GET | `?carId=<uuid>` | Gallery, provider states, selected photo, cache/job timing |
| POST JSON | `{carId,refresh?:boolean}` | 202 with current state; claims a due job, otherwise uses cache; explicit too-soon refresh returns 429 |
| POST multipart | `carId`, `file`, `rightsConfirmed=true` | Private R2 upload and refreshed gallery |
| PATCH | `{carId,primaryId?:uuid|null,hideExternal?:boolean}` | Validates an unexpired owned gallery entry, saves preferences |
| DELETE | `?carId=<uuid>&photoId=<uuid>` | Removes one permitted entry and owned object, if applicable |
| DELETE | `?carId=<uuid>` | Cancels current lease and clears external results; retains owned uploads |
| GET | `?carId=<uuid>&photoId=<uuid>` | Owner-only uploaded image stream; private/no-store, nosniff and same-origin policy |

## Storage, jobs and cleanup

Migration `drizzle/0002_vehicle_photo_search.sql` is additive and idempotent. It creates job/preferences, photo metadata, daily counters and an R2 garbage-collection outbox, with owner/car/VIN/expiry and dedupe indexes. Car characteristics stay in existing records. Apply through the normal Sites D1 migration flow (or the local adapter's ordered migrations). Never activate the unrelated staged money migration as part of this feature.

External URLs are cached as metadata only: positive results one hour by default, model metadata one day, negative results 15 minutes, failures one minute. Paid TTL is clamped to 60–86,400 seconds. Contract-specific retention can require a shorter setting or keeping a provider disabled. Expired rows are not served and are purged during cleanup. There is no separate cache of raw provider response bodies. Each photo has a unique owner/car/URL key; owned files additionally dedupe by SHA-256 content hash. Car creation uses an atomic insert-if-no-owned-VIN predicate.

Workers `waitUntil` executes parallel providers with 6.5-second request limits and at most one exponentially delayed retry for transport/5xx failures. 401/403/404/429 are not retried. Responses are bounded to 256 KB and redirect following is disabled. The job lease lasts 25 seconds, within Workers' post-response lifecycle budget. D1 persists state, but **this is not an exactly-once durable queue**: interrupted jobs become retryable after lease/cooldown expiry. Add a Cloudflare Queue/Workflow for stronger execution guarantees or longer tasks.

Parent deletion/VIN-change triggers atomically remove photo metadata/jobs and enqueue private object keys. Provider writes also check the current parent VIN and lease, so late results cannot resurrect data. Successful record mutations and photo operations drain the bounded GC outbox. Interrupted cleanup retains keys for a later retry; a scheduled GC consumer is a future operational improvement. `removeOwnerPhotoData(owner)` is provided for an authenticated account-deletion flow; Motorna currently has no account-deletion endpoint, so no such endpoint is claimed. New photo writes must be stopped before invoking an account-wide deletion workflow.

## Verification and extension

`tests/vehicle-intelligence.mjs` runs actual adapters/store/API against isolated SQLite and an R2 mock, with mocked provider HTTP responses. It covers VIN/match classification, malformed/empty/failed sources, timeout, 401/403/404/429/500, budgets/cache/job dedupe, ownership/CSRF/JSON limits, upload validation, selected photo, visibility, deletion, stale VIN/lease writes and object cleanup. No real paid calls run in regression tests.

`tests/e2e/vehicle-photos.spec.ts` covers VIN input/decode fixture, saving and repeated save, gallery, actual local image upload, primary selection, reload and deletion on desktop/mobile. E2E uses a fresh isolated local database under `.sites-runtime/e2e-*` for every run and explicitly disables server-side external photo providers; provider HTTP behavior is exercised through offline mocks. Existing purchase/garage/security E2E remains in the full suite.

To add a provider: first document API/auth/tariff/image rights; implement schema-validated normalization and explicit VIN evidence; register it in the service; reserve paid attempts; supply positive/error mocks; test expiry and owner boundaries. Never label an inference as exact VIN proof.

Next improvements: contracted AUTO.RIA/auction connectors; durable Queue and scheduled GC; optional client-side EXIF stripping/re-encoding; provider-specific revoked-image removal webhooks; contracted build-data VIN decoding. No photo module can replace an OEM catalogue or prove part compatibility.
