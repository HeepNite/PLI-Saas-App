# Tasks: Kiosk Spanish and QR Check-In Redesign

## Review Workload Forecast

| Field | Value |
|---|---|
| Decision needed before apply | Yes |
| Chained PRs recommended | Yes |
| Chain strategy | feature-branch-chain |
| 400-line budget risk | High |

**Estimated line budget breakdown**

| Work Unit | New/Modified Files | Estimated Lines |
|---|---|---|
| WU-1: Foundation (shared resolver + kiosk labels) | 2 new, 2 modified | ~160 |
| WU-2: QR API routes (context + PIN) | 2 new, 1 modified | ~180 |
| WU-3: QR client routing + terminal label wiring | 4 modified | ~200 |
| WU-4: Tests + E2E | 4 new/modified | ~160 |
| **Total** | | **~700** |

Total well exceeds 400 lines. Recommend 3–4 chained PRs using `feature-branch-chain` so the tracker branch accumulates the final integration while child PR diffs stay focused.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Suggested PR split**

- **PR 1** — WU-1: base = `feature/kiosk-spanish-and-qr-entry`; `current-class-context.ts` + `kiosk-labels.ts` + type additions to `checkin.types.ts`
- **PR 2** — WU-2: base = PR 1 branch; `app/api/checkin/qr/context/route.ts` + `app/api/checkin/qr/pin/route.ts` + `checkin-qr-api.ts` client helper
- **PR 3** — WU-3: base = PR 2 branch; `StaffTerminalShell` lang toggle + `CheckInQrClient` QR context state + `existing-customer-flow.ts` QR routing + `CheckInHeader` label wiring + `useCheckInQrController` / `useCheckInQrShellProps` / `CheckInQrShell` label consumption
- **PR 4** — WU-4: base = PR 3 branch; Vitest unit + API route tests + RTL component tests + E2E extension

---

## Phase 1 — Foundation: Shared Resolver and Label Map

> **Goal**: pure, zero-side-effect building blocks that both terminal shell and QR API depend on.
> All tasks in this phase are spec-driven by `kiosk-language-switch` and `qr-entry-context-resolver`.

- [ ] **T1.1** — Write failing unit test: `buildKioskLabels("en")` returns all required keys as non-empty strings
  - `tests/checkin/kiosk-labels.test.ts`
- [ ] **T1.2** — Write failing unit test: `buildKioskLabels("es")` returns no empty or undefined value for any key
  - `tests/checkin/kiosk-labels.test.ts`
- [ ] **T1.3** — Create `lib/checkin/kiosk-labels.ts`: define `KioskLang = "en" | "es"` and `buildKioskLabels(lang: KioskLang)` covering every terminal-visible string (heading, welcome, PIN prompts, package/drop-in CTAs, error messages, overlay strings)
- [ ] **T1.4** — Make T1.1 and T1.2 pass
- [ ] **T1.5** — Write failing unit test: `resolveActiveClass()` returns `null` when no class window is active; returns correct `TodayClassItem` when one is active
  - `tests/checkin/current-class-context.test.ts`
- [ ] **T1.6** — Write failing unit test: `resolveActiveClass()` never falls back to nearest/next class outside the active window (strict no-fallback rule)
  - `tests/checkin/current-class-context.test.ts`
- [ ] **T1.7** — Write failing unit test: `resolvePromoEligible(item)` returns `true` only when an active `CourseLink` exists and the linked class is scheduled later the same day
  - `tests/checkin/current-class-context.test.ts`
- [ ] **T1.8** — Create `lib/checkin/current-class-context.ts`: export `TodayClassItem` type, `resolveActiveClass(classes, now)`, and `resolvePromoEligible(item, todayClasses)` — pure functions, no DB calls
- [ ] **T1.9** — Make T1.5, T1.6, T1.7 pass
- [ ] **T1.10** — Add `lang?: KioskLang`, `qrContext`, and `QrContextResponse` types to `components/front/checkin/checkin.types.ts`

---

## Phase 2 — QR API Routes

> **Goal**: server-side class resolution and student PIN verification without auth boundary changes.
> Spec: `qr-entry-context-resolver`, `qr-identity-router`.

- [ ] **T2.1** — Write failing API test: `GET /api/checkin/qr/context` returns `{ classId, courseSlug, date, time, promotionEligible }` when active class found
  - `tests/api/checkin-qr-context.test.ts`
- [ ] **T2.2** — Write failing API test: returns `{ status: "no-active-class" }` when no class is active (including gap between classes)
  - `tests/api/checkin-qr-context.test.ts`
- [ ] **T2.3** — Write failing API test: rate limit enforced; 429 on excess unauthenticated calls
  - `tests/api/checkin-qr-context.test.ts`
- [ ] **T2.4** — Create `app/api/checkin/qr/context/route.ts`: unauthenticated, rate-limited; calls DB for today's schedule; uses `resolveActiveClass` + `resolvePromoEligible` from Phase 1; returns `QrContextResponse`
- [ ] **T2.5** — Make T2.1, T2.2, T2.3 pass
- [ ] **T2.6** — Write failing API test: `POST /api/checkin/qr/pin` returns `{ ok: true, qrStudentContextToken, userId }` for valid PIN + active class context
  - `tests/api/checkin-qr-pin.test.ts`
- [ ] **T2.7** — Write failing API test: returns `{ ok: false, reason: "invalid-pin" }` for wrong PIN; `{ ok: false, reason: "rate-limited" }` on excess attempts; `{ ok: false, reason: "no-active-class" }` when context expired
  - `tests/api/checkin-qr-pin.test.ts`
- [ ] **T2.8** — Write failing API test: PIN validation does not create staff/terminal-management session — response contains no staff capability fields
  - `tests/api/checkin-qr-pin.test.ts`
- [ ] **T2.9** — Create `app/api/checkin/qr/pin/route.ts`: rate-limited; validates student PIN server-side; returns class-scoped identity token only; no staff auth surfaces
- [ ] **T2.10** — Make T2.6, T2.7, T2.8 pass
- [ ] **T2.11** — Add `requestQrContextApi()` and `requestQrPinApi()` to `lib/checkin/checkin-qr-api.ts`

---

## Phase 3 — QR Client Routing and Terminal Label Wiring

> **Goal**: wire label map into terminal components; add QR context state machine and identity routing to client hooks.
> Spec: `kiosk-terminal-ui`, `kiosk-language-switch`, `qr-identity-router`, `checkin-package`.

- [ ] **T3.1** — Write failing RTL test: `CheckInHeader` with `variant="terminal"` and `lang="es"` renders Spanish heading and welcome text
  - `tests/components/CheckInHeader.test.tsx`
- [ ] **T3.2** — Write failing RTL test: `CheckInHeader` with `variant="personal"` renders unchanged English literals regardless of any label prop
  - `tests/components/CheckInHeader.test.tsx`
- [ ] **T3.3** — Modify `components/front/checkin/CheckInHeader.tsx`: accept optional `labels` prop; render from label map when `variant="terminal"`; keep hardcoded literals for `personal`
- [ ] **T3.4** — Make T3.1, T3.2 pass
- [ ] **T3.5** — Write failing RTL test: `StaffTerminalShell` renders `EN | ES` toggle; switching to ES passes `lang="es"` to `CheckInQrClient`
  - `tests/components/StaffTerminalShell.test.tsx`
- [ ] **T3.6** — Write failing RTL test: toggle state resets to `"en"` after remount (no persistence)
  - `tests/components/StaffTerminalShell.test.tsx`
- [ ] **T3.7** — Modify `components/front/staff/StaffTerminalShell.tsx`: add `lang` state defaulting to `"en"`; render toggle control; pass `lang` to `CheckInQrClient`; remove local `computeCurrentSlug` — use `resolveActiveClass` from `current-class-context.ts`
- [ ] **T3.8** — Make T3.5, T3.6 pass
- [ ] **T3.9** — Modify `components/front/checkin/hooks/useCheckInQrController.ts`: on mount (when `fromQr=1`), call `requestQrContextApi()`; gate all identity routing on resolved context; emit `no-active-class` state when resolver returns it; no fallback to next class
- [ ] **T3.10** — Modify `components/front/checkin/hooks/useCheckInQrShellProps.ts`: derive label-driven shell props from `buildKioskLabels(lang)` for terminal variant only
- [ ] **T3.11** — Modify `components/front/checkin/CheckInQrShell.tsx`: consume `labels` from shell props for all terminal-visible strings; render `no-active-class` non-interactive message state
- [ ] **T3.12** — Modify `lib/checkin/existing-customer-flow.ts`: extend routing guards to accept optional QR-resolved class context; keep public and terminal gates separate; no anonymous QR bypass
- [ ] **T3.13** — Write failing RTL test: `CheckInQrClient` with no session renders PIN prompt (not anonymous entry)
  - `tests/components/CheckInQrClient.test.tsx`
- [ ] **T3.14** — Write failing RTL test: QR `no-active-class` state renders informative message with no check-in CTA
  - `tests/components/CheckInQrClient.test.tsx`
- [ ] **T3.15** — Write failing unit test: `shouldAutoTriggerPackageCheckIn` returns `false` on QR path when `hasConsecutiveOffer=true` and `consecutiveOfferSettled=true`
  - `tests/checkin/package-gate.test.ts`
- [ ] **T3.16** — Make T3.13, T3.14, T3.15 pass

---

## Phase 4 — Tests, E2E, and Polish

> **Goal**: full coverage of spec scenarios; confirm public flow is unaffected; extend E2E.

- [ ] **T4.1** — Verify all Phase 1–3 unit/API/RTL tests pass with focused `npx vitest run ...` commands, then `npx tsc --noEmit`
- [ ] **T4.2** — Extend `tests/e2e/checkin-terminal.spec.ts` (or equivalent): terminal EN/ES toggle switches labels; existing terminal rotation/check-in flow still passes
- [ ] **T4.3** — Write E2E: QR path with active session routes to check-in without PIN prompt
- [ ] **T4.4** — Write E2E: QR path without session shows PIN prompt; valid PIN proceeds to bootstrap
- [ ] **T4.5** — Confirm public `/checkin` does not call `GET /api/checkin/qr/context` unless the explicit QR entry path/flag is present
- [ ] **T4.6** — Manual verification checklist: public `/checkin` DOM contains no language toggle; no `lang` prop in public render tree

---

## Completion Gate

All tasks marked `[ ]` → `[x]` before the change is considered `applied`.
No code changes are permitted outside the files enumerated in `design.md`.
