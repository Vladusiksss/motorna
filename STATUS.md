# Стан локальної версії

- Пошук автомобіля лише за VIN; держномери відхиляються до запитів у джерела.
- PostgreSQL із компактним імпортом відкритих даних МВС та пошуком останнього відомого запису за VIN.
- Backend перевіряє зміни файлів щодня, поки працює. Ресурси без змін пропускаються.
- Автоматичне збереження підтвердженого авто у гараж, історія пошуку, калькулятор із останнього запиту.
- Плани та список покупок прибрано з інтерфейсу.
- Перевірено: TypeScript, production build, реальний VIN через backend і вебдодаток, відхилення держномерів, пропуск незміненого імпорту.
- Візуальна перевірка браузером не виконана: інструмент браузера недоступний.
- Поточні зміни лише локальні. Локальна AI-модель працює; ціни читаються з доступних сторінок продавців. Зовнішній пошук СТО залежить від доступності сервера карт. Докладніше в README.md.

2026-09-29: Automatic product lookup now resolves the saved car for the authenticated owner. Removed the Google product-search handoff. Returned products retain an explicit unverified VIN-fitment status. OEM API access remains required for exact compatibility; see OEM-INTEGRATION.md. TypeScript and local API/product regression tests passed. Changes remain local.

2026-09-29 — Symptom analysis:
- Replaced free-form AI paraphrasing with conservative spelling corrections and description confirmation. Unrecognized wording remains unchanged.
- AI selects symptom groups with verbatim evidence; server supplies inspection explanations, qualifying conditions and checks. No three-cause limit, no invented probability percentages.
- Ambiguous starting symptoms prompt clarification; normal cranking excludes starter suggestions; diesel context excludes spark plugs/coils.
- Five live AI scenarios passed, TypeScript and production build passed. Unit regression: node tests/diagnostic-guide.mjs. Browser visual verification unavailable in this environment.
- Technical background: https://www.denso-am.eu/news/starter-troubleshooting and https://www.monroe.com/technical-resources/tech-tips/diagnosing-noise-with-new-shock-struts.html . Guidance remains a limited set of inspection scenarios, not an exhaustive diagnostic system.

2026-09-29: Removed description confirmation. Added multi-turn symptom chat with separate reply field, request history, retry preserving reply, and updated current causes. Added slow-acceleration inspection scenario and progressive questions. Exact diagnosis still requires inspection. Local-only update.

2026-09-29: Added product overview with prices derived from returned offers and linked sources; optional OEM input with exact structured MPN/SKU or title matching. VIN compatibility remains unverified without OEM provider access. Calculator now opens actual offer URLs.
2026-09-29: Replaced address lookup with Nominatim building/street results, explicit address choice, request cancellation and stale-result protection. Google directions use the selected origin. OSRM table supplies road distance/time and sorts retrieved nearby stations; estimates exclude traffic. Waze is explicitly labeled as navigation from current location. Live test: Vasylkivska 30 resolved separately from Velyka Vasylkivska 30, returned 20 stations, with computed road routes. Public map services remain external dependencies. Tests: tests/station-routing.mjs; tests/catalog-number.mjs.
Map URL reference: https://developers.google.com/maps/documentation/urls/get-started

2026-09-29: Station cards default to named OSM listings with both phone and opening hours; optional toggle shows incomplete records. Removed generic/unnamed and marked disused listings. Multiple phone numbers become separate validated tel links, Ukrainian local numbers normalized, weekday labels translated without inventing open-now status. Each card links its source. Live Brovary lookup returned named businesses with contacts and schedules. Map listings do not guarantee current operation.

2026-09-29: Removed calculator UI and history calculator action. Compact map source attribution replaces old copyright wording. Engine-knock scenario now returns causes with explanations directly in chat; only curated, non-repeated clarification questions remain. Full UI chat is retained, while assistant context is bounded for local inference.
