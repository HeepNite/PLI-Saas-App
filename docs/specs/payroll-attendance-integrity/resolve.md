# Payroll Attendance Integrity (P0) — Resolve

## Accepted Decisions

### D1. Login and check-in are separate contracts (ACCEPTED)
- Login is authentication-only.
- Login MUST NOT create/update/close attendance artifacts.

### D2. Canonical payroll source is singular (ACCEPTED)
- `StaffClockEntry` is the authoritative source of payroll hours in P0.
- Payroll totals MUST be reproducible from DB entries without metadata approximation.

### D3. On-demand automatic closure is P0 mechanism (ACCEPTED)
- Because scheduler/cron infra does not exist, P0 uses an idempotent closure service invoked before payroll reads.
- Scheduler is explicitly not in P0 scope.

### D4. Deterministic closure timestamp baseline (ACCEPTED)
- Default timestamp formula: `min(now, expectedClockOutAt + 15m, clockInAt + 10h/600m cap)`.
- Closure operation MUST be idempotent and auditable.

### D5. Presence policy defaults (ACCEPTED)
- Valid presence sources: explicit check-in, real panel activity, admin/owner adjustment.
- Auth/session-open state alone is not valid work presence.

### D6. Legacy metadata authority removal (ACCEPTED)
- `publicMetadata.staffPayroll.hoursWorked` is deprecated as authoritative payroll source.
- Payroll APIs use canonical DB entries; profile surfaces require bridge/deprecation strategy.

### D7. Conflict with existing force_logout behavior (ACCEPTED)
- Existing `force_logout` behavior that mutates metadata hours from `staffLastCheckInAt` conflicts with canonical DB policy.
- P0 implementation must neutralize this conflict (remove or constrain to non-authoritative compatibility semantics).

## Remaining Open Questions

1. **Safe fallback for weak expected anchors**
   - For missing/invalid/zero-duration `expectedClockOutAt`, define exact fallback closure formula and reason codes.

2. **Profile bridge behavior during migration**
   - `users/profile` response should either derive canonical hours live or expose clearly deprecated metadata field semantics.
   - Confirm exact API contract wording and compatibility timeline.

3. **Timezone/day-boundary policy detail**
   - Confirm canonical timezone for cap/grace boundary evaluation to avoid cross-day drift.

4. **Future scheduler trigger**
   - Non-P0: define criteria for introducing scheduler/cron once infra exists and on-demand closure metrics justify it.

## P0 Scope Guardrail

- P0 includes: canonical source alignment + on-demand closure + payroll read invocation + bridge/deprecation handling.
- P0 excludes: new scheduler/cron infrastructure and rich correction dashboard.
