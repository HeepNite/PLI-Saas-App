# Resolution

## Contract Decisions

1. Use two independent slugs: `october-30-raffle-2026` and `october-31-raffle-2026`.
2. Preserve legacy `/rifa`; add `/rifa/30` and `/rifa/31`.
3. Use one temporary draw per DEV event labeled `Temporary test prize — replace before event`. This is test data, not a final prize decision.
4. Set every temporary draw for a day to that day's midnight boundary:
   - October 30 event → `2026-10-31T04:00:00Z`.
   - October 31 event → `2026-11-01T04:00:00Z`.
5. Generate an independent token during initial seed for each event. Never copy or reuse the Latino Night token.
6. Do not import the legacy `fix/raffle-migration-repair` migration. Reassess only the exact DEV database during preflight.

## Context Strategy

The active behavioral source is this folder. Existing event-raffle OpenSpec documents remain background for the generic raffle contracts; this spec owns only October 30–31 preparation.

## Minimal Architectural Changes

- Add a typed, allowlisted day-to-event mapping.
- Add one dynamic server page that reuses the existing cookie verification and access form.
- Extend the shared floating-chrome route matcher to the two new exact paths.
- Add deterministic JSON seed inputs; make no schema or API changes.

## Spec Adjustments

The legacy `/rifa` route remains a Latino Night historical entrance. The new permanent paths avoid a date-dependent selector and prevent one night's operational setup from changing the other.

## Implementation Preconditions

- Tests must first fail for missing `/rifa/30` and `/rifa/31` behavior.
- DEV identity and migration/schema state must be proven before seeding.
- If either target slug already exists, setup must stop for readback before deciding whether token rotation or data replacement is safe.
- Raw tokens need a secure handoff location approved before the one-time seed output is produced.
