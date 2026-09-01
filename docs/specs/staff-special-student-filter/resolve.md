# Resolved Contract

- Extend the existing catalog query with `scheduleRules`; do not filter by `active`.
- Build a slug-to-boolean semantic map with `parseScheduleRules`, defaulting to `false`.
- Project `isSpecialEvent` from either non-null `Purchase.specialClassId` or the slug-to-boolean catalog map.
- Add `special` to Today categories and a separate `HistoryEventKindFilter` for History.
- Apply Special at row level so card inclusion remains “at least one matching row.”
- Disable remote profile fallback for Today Special while retaining local row text filtering.
- Leave cash settlement selection and mutation logic unchanged.
- Keep ordinary purchases false when neither semantic source identifies a special event.
