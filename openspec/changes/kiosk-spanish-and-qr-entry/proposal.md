# Proposal: Kiosk Spanish and QR Check-In Redesign

## Intent

Add a language switch (English/Spanish) to the kiosk terminal and rebuild the QR entry flow so it behaves like terminal check-in: it resolves the current class from date/time, evaluates the second-class promotion, and routes the user through purchase or package check-in depending on their identity state.

## Scope

### In Scope
- `KioskLang` type + `buildKioskLabels()` factory with `en`/`es` variants for all terminal-visible strings.
- Language toggle UI inside `StaffTerminalShell` (persisted per-session, not globally).
- QR landing page/route that determines day, date, time, and resolves the current class before any user interaction.
- Identity routing on QR entry: logged-in → purchase/check-in flow; PIN-only → PIN-gated purchase/check-in; active package → direct package check-in.
- Second-class (consecutive) promotion evaluation within the QR entry path.
- Security boundaries (auth, rate limiting, existing validations) preserved without modification.

### Out of Scope
- Global i18n infrastructure or `next-intl`/`i18next` dependencies.
- Localization of the public `/checkin` page or staff dashboard.
- Changes to the core check-in business logic beyond QR entry routing.
- New database schema changes.

## Capabilities

### New Capabilities
- `kiosk-language-switch`: scoped label system that toggles terminal strings between English and Spanish without a global i18n layer.
- `qr-entry-context-resolver`: derives current class (day/date/time) at QR scan time and feeds it into the check-in pipeline.
- `qr-identity-router`: branches QR flow based on login state, PIN availability, and active package, mirroring terminal check-in logic.

### Modified Capabilities
- `checkin-package`: QR path now evaluates consecutive promotion before completing check-in (same gate as terminal flow).
- `kiosk-terminal-ui`: receives `lang` prop; all user-visible labels sourced from `buildKioskLabels(lang)`.

## Approach

1. **Language switch** — Add `KioskLang = "en" | "es"` to the terminal shell. `buildKioskLabels(lang)` returns a typed label map. Toggle stored in component state; no backend or cookie required. All existing terminal string literals replaced with label map references.
2. **QR context resolver** — On QR scan, call a new lightweight endpoint (`GET /api/checkin/qr/context`) that returns `{ classId, date, time, promotionEligible }` based on studio schedule. This replaces the current static QR behavior.
3. **QR identity router** — After context resolution: if session active → enter existing purchase/check-in flow; if no session but PIN known → prompt PIN then enter flow; if active package → direct package check-in. Logic mirrors `existing-customer-flow.ts` guards already used in terminal.
4. **Promotion gate** — Reuse `shouldAutoTriggerPackageCheckIn` + consecutive offer resolution already present in `CheckInQrClient`; QR path passes resolved class context instead of relying on ambient state.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/staff/StaffTerminalShell.tsx` | Modified | Add language toggle; pass `lang` down. |
| `lib/checkin/kiosk-labels.ts` | New | `KioskLang` type + `buildKioskLabels()` factory. |
| `components/front/checkin/CheckInQrClient.tsx` | Modified | Accept resolved class context; apply identity routing. |
| `lib/checkin/existing-customer-flow.ts` | Modified | Extend guards to accept QR-resolved class context. |
| `app/api/checkin/qr/context/route.ts` | New | Returns current class + promotion eligibility from schedule. |
| `components/front/checkin/CheckInHeader.tsx` | Modified | Render labels from `buildKioskLabels(lang)`. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| QR context resolver returns wrong class during schedule gaps | Med | Return explicit `no-active-class` state; QR UI shows informative message instead of silently failing. |
| PIN prompt on QR path bypasses auth guards | Low | PIN validation reuses existing server-side PIN check; no new auth surface introduced. |
| Language toggle leaks into non-kiosk check-in pages | Low | Toggle is scoped to `StaffTerminalShell`; labels never reach public `/checkin` path. |
| Promotion double-trigger if QR and terminal run concurrently | Low | Idempotency already enforced by `hasAttendedCourseToday`; no extra guard needed. |

## Rollback Plan

All changes are additive or isolated behind `shellVariant === "terminal"` and the new QR context endpoint. To rollback: remove `kiosk-labels.ts`, revert `StaffTerminalShell` to previous string literals, revert `CheckInQrClient` identity routing additions, and delete the QR context route. No DB migrations; no data loss.

## Success Criteria

- [ ] Language toggle visible on kiosk terminal; switching renders all terminal strings in Spanish without page reload.
- [ ] QR scan resolves correct class from current day/date/time before any user interaction.
- [ ] Logged-in user scanning QR enters purchase/check-in flow directly.
- [ ] User with PIN only can complete check-in via PIN prompt on QR path.
- [ ] User with active package is checked in directly via package on QR scan.
- [ ] Consecutive (second-class) promotion is evaluated and shown when eligible on QR path.
- [ ] Public `/checkin` and non-kiosk flows are unaffected.
- [ ] Existing terminal E2E tests continue to pass.
