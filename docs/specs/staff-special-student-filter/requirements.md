# Staff Special Student Filter

## Today board

- Add `Special` beside the existing top-level payment categories.
- A payment row is Special when `Purchase.specialClassId` is non-null or its catalog course has parsed `scheduleRules.mode === "special_event"`.
- Include a student card when at least one row matches, without changing card details.
- Do not use generic profile-search fallback in Special; local text search still filters loaded Special cards.

## History

- Add an independent event-kind filter with `all | special` values.
- Compose it with date range, text, class, payment method, attendance, and status filters.
- Selecting Special keeps History active.

## API and boundaries

- Use canonical `Purchase.specialClassId` linkage together with server-parsed catalog rules, and expose only `PaymentRow.isSpecialEvent`.
- Missing catalogs, malformed/null rules, and non-special modes resolve to `false` only when the purchase also has no SpecialClass linkage; catalog activity is irrelevant.
- Add no schema, endpoint, or dependency; preserve settlement, kiosk, check-in, phone, and unrelated behavior.
