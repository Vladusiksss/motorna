# OEM/VIN integration — 2026-09-29

## Current application
The automatic offers endpoint accepts a saved car ID and resolves its vehicle data server-side for the signed-in owner. It finds direct seller product links with observed prices. It does not verify VIN applicability. All returned offers explicitly carry fitment.status = unverified. Model/year matching is not proof of fitment.

## Candidate provider
YQ Service offers an OEM catalogue REST API with VIN identification, manufacturer categories and original part numbers. Demo access must be requested; coverage for the actual VIN, commercial terms, caching rights and aftermarket cross-reference licensing must be confirmed before integration.
Official source and demo request: https://www.yqservice.eu/vin-search/
Demo overview: https://restdemo.yqservice.eu/

No provider account was created, no inquiry sent and no subscription purchased. No undocumented endpoint or fabricated OEM response is implemented.

## Ready-to-send inquiry (not sent)
Hello, we are building MOTORNA, a Ukrainian automotive parts search application for Kyiv and Kyiv region. We need an API that resolves a VIN to the exact vehicle configuration and applicable OEM part numbers, independently of a TecDoc subscription. Please provide trial API access and documentation, supported brands and European-market VIN coverage (including Audi), category/part search capabilities, supersession and aftermarket cross-reference support, pricing, request limits, and rights to display/cache applicability results. We would like to validate VIN → configuration → selected part → OEM number before purchasing.

## Acceptance requirements for integration
- Resolve the confirmed saved VIN through the provider, never trust a client-supplied vehicle description.
- Select the exact part category and position; ask for missing configuration/PR codes when the provider cannot resolve them.
- Preserve OEM number, provider, vehicle configuration, applicability evidence and verification time.
- Search sellers by OEM number; only label a product confirmed when its exact article/OEM cross-reference is supported by the provider evidence.
- A timeout, unsupported VIN, ambiguous variant or missing cross-reference must remain unverified.
- Keep credentials on the server and test an applicable part plus a deliberately incompatible variant.
