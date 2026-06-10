# Design: Kiosk Spanish and QR Check-In Redesign

## Technical Approach

Keep the change localized to the existing check-in slice. Extract the terminal class-selection math from `StaffTerminalShell` into a pure shared resolver, then use it from both the terminal shell and new `GET /api/checkin/qr/context`. Add a typed kiosk label map for terminal-only Spanish/English copy. Route QR entry through existing bootstrap/package/drop-in/PIN primitives; do not change core attendance, payment, Clerk, or package APIs.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Shared current-class resolution | Create `lib/checkin/current-class-context.ts` with pure `TodayClassItem` + resolver helpers reused by `StaffTerminalShell` and QR context route | Duplicate `computeCurrentSlug` in API | Single source of timing truth prevents QR/terminal drift. |
| Scoped labels | Create `lib/checkin/kiosk-labels.ts`; pass labels/lang through terminal render props only | Add global i18n library | Requirement excludes global i18n; typed map keeps blast radius small. |
| QR context endpoint | Add unauthenticated, rate-limited `app/api/checkin/qr/context/route.ts` that returns resolved active-class context or `no-active-class` | Resolve context only in browser query params; fallback to next class | Server owns schedule lookup and rate-limit boundary. QR is physically displayed on the kiosk and must be actionable only during an active class window. |
| QR routing | Extend `CheckInQrClient` controller with a QR-entry resolved context state before identity routing | New standalone QR flow | Reuses tested bootstrap/package/purchase behavior and avoids parallel business logic. |
| Student PIN boundary | Add a public, rate-limited student PIN verification path scoped to the resolved QR class context; do not require staff terminal auth | Reuse staff-terminal PIN endpoint; require Clerk before PIN | Staff auth protects terminal configuration only. Student PIN protects student identity and may create a class-scoped check-in context, never a staff or terminal-management session. |

## Data Flow

    StaffTerminalShell ── fetch today classes ──→ current-class-context
            │                                      │
            └──── CheckInQrClient(lang, slug)      └── QR context route

    /checkin?fromQr=1 ── GET /api/checkin/qr/context
        ├─ no-active-class/error → non-interactive message
        └─ valid context → logged-in or student PIN route → qr/bootstrap → package/drop-in flow

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/checkin/current-class-context.ts` | Create | Pure shared class sorting/time resolution helpers. |
| `components/front/staff/StaffTerminalShell.tsx` | Modify | Remove local `computeCurrentSlug`; add local `lang` state and toggle; pass `lang`. |
| `lib/checkin/kiosk-labels.ts` | Create | `KioskLang` and `buildKioskLabels(lang)` typed terminal label map. |
| `components/front/checkin/checkin.types.ts` | Modify | Add optional `lang` and resolved QR-context props/types. |
| `components/front/checkin/hooks/useCheckInQrController.ts` | Modify | Resolve QR context before routing; thread labels; keep terminal effects reusable. |
| `components/front/checkin/hooks/useCheckInQrShellProps.ts` | Modify | Derive label-driven shell props for terminal only. |
| `components/front/checkin/CheckInQrShell.tsx` | Modify | Consume label map for terminal-visible strings and QR context states. |
| `components/front/checkin/CheckInHeader.tsx` | Modify | Use provided terminal labels; preserve personal variant literals. |
| `app/api/checkin/qr/context/route.ts` | Create | Rate-limited schedule resolver endpoint. |
| `app/api/checkin/qr/pin/route.ts` | Create | Rate-limited student PIN verification for QR context; returns class-scoped identity token/context only. |
| `lib/checkin/checkin-qr-api.ts` | Modify | Add `requestQrContextApi`. |
| `lib/checkin/existing-customer-flow.ts` | Modify | Reuse existing routing guards with QR-resolved context; keep public and terminal flows gated separately. |
| Tests under `tests/checkin` and `tests/api` | Modify/Create | Cover labels, context route, QR routing, and promotion gate. |

## Interfaces / Contracts

```ts
export type KioskLang = "en" | "es"
export type QrContextResponse =
  | { classId: string; courseSlug: string; date: string; time: string; durationMinutes: number; promotionEligible: boolean }
  | { status: "no-active-class" }

export type QrPinVerifyResponse =
  | { ok: true; qrStudentContextToken: string; userId: string; requiresPinRotation: boolean }
  | { ok: false; reason: "invalid-pin" | "rate-limited" | "no-active-class" }
```

`CheckInQrClient` accepts `lang?: KioskLang` defaulting to `"en"`; non-terminal render paths must not pass or observe it.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | label coverage/defaults; shared active-class resolver; QR identity routing guards | Vitest pure-function tests. |
| API | `/api/checkin/qr/context` and `/api/checkin/qr/pin` success, no-active-class, invalid PIN, rate limit, promotion flag | Route tests following existing check-in API test style. |
| Component | terminal EN/ES labels; public `/checkin` unchanged; QR resolved/no-active/error states | React Testing Library. |
| E2E | terminal still rotates/checks in; QR logged-in and PIN/security paths | Extend existing check-in/terminal specs. |

## Migration / Rollout

No migration required. Additive route and terminal-local UI state only. Rollback removes the new helper, labels, route, and prop threading.

## Open Questions

None. User confirmed QR should use strict kiosk active-class behavior and that student PIN identity must not require staff terminal auth.
