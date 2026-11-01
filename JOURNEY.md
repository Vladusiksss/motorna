# User journey

- VIN lookup: hosted vehicle-only MVS snapshot (2,526,081 records imported in October 2026), with vPIC and guarded DB.VIN fallbacks. These sources do not establish OEM fitment or factory options.
- Confirming a vehicle saves it in the signed-in user's garage; the sign-in return restores the pending VIN result.
- A part, symptom-derived part or catalog number starts server-side public-page discovery. Prices are shown only when extracted from an accessible product page. Authentication, CAPTCHA, HTTP 403 and restricted interfaces are not bypassed. Provider availability is not guaranteed.
- Filters cover seller, manufacturer, availability, catalog-number match and price in a single selected currency. An exact article match does not mean VIN fitment.
- Add a live offer to a purchase inquiry, review quantity, VIN, links and source-price snapshots, then save a draft. Separate currency totals exclude shipping. No payment, reservation or automatic supplier message occurs.
- If no live offer is available, a no-price part-selection inquiry remains available. Copy or download its text and send it to a seller yourself for OEM/VIN confirmation.
- Drafts are owner-scoped `purchaseRequest` records. The server derives VIN and vehicle from that owner's garage, rejects demo lines and refuses paid/sent/verified claims. Legacy product fixtures in `app/data.ts` are explicitly demo and are not used as live search results.

Validation: TypeScript, `tests/purchase-journey.mjs`, existing offer and VIN regression tests, local API persistence/ownership checks, and public production checks after publishing. Local test offers are fixtures, not current merchant quotes.
