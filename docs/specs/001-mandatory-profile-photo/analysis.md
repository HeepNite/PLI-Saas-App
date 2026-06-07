# Analysis
## Existing Implementation
- Check-in entry points already exist and map to two device experiences:
  - `app/checkin/page.tsx` renders `CheckInQrClient` for QR/web access.
  - `app/staff/terminal/page.tsx` renders `StaffTerminalShell`, which mounts `CheckInQrClient` with `forcedDeviceMode="station"` and `shellVariant="terminal"`.
- Context is currently inferred via multiple flags in `components/front/checkin/CheckInQrClient.tsx` (`shellVariant`, `forcedDeviceMode`, query params like `device`/`fromQr`, and viewport width via `matchMedia`).
- New-student onboarding currently happens inside `components/front/courses/EnrollModal.tsx` (`flowVariant="checkin-new"`), with steps for service/date-contact/payment only. There is no profile photo step, no camera handling, and no photo-based blocking condition.
- Existing avatar upload endpoints are already present:
  - `PATCH /api/staff/users/[userId]/avatar` in `app/api/staff/users/[userId]/avatar/route.ts` (staff-portal auth, rate limited, Clerk profile-image update).
  - `POST /api/profile/avatar` in `app/api/profile/avatar/route.ts` (signed-in user self-service avatar update).
- Existing profile completion logic does not include avatar/photo:
  - `app/api/profile/route.ts` computes `profileComplete` using birth date + emergency contact fields only.
  - `components/front/profile/profile-utils.ts` computes completion percent from 6 text/date fields only.
- Tests currently cover basic avatar and check-in APIs but not mandatory-photo policy/gating:
  - Avatar API tests: `tests/api/profile-avatar.test.ts`
  - QR check-in API smoke tests: `tests/api/checkin-qr-bootstrap.test.ts`, `tests/api/checkin-qr-dropin.test.ts`, `tests/api/checkin-qr-package.test.ts`
  - E2E check-in/profile flows: `e2e/checkin.spec.ts`, `e2e/profile.spec.ts`

## Affected Files
- `components/front/checkin/CheckInQrClient.tsx`: current context inference and flow wiring; primary integration point for explicit photo-flow context.
- `components/front/courses/EnrollModal.tsx`: current new-student flow, step validations, and completion controls; where photo-required gating must be enforced.
- `app/staff/terminal/page.tsx` and `components/front/staff/StaffTerminalShell.tsx`: kiosk-terminal context entry point and existing terminal session boundaries.
- `app/checkin/page.tsx`: QR/web context entry point.
- `app/api/staff/users/[userId]/avatar/route.ts`: required existing avatar endpoint contract from the spec.
- `app/api/profile/avatar/route.ts`: existing self-service avatar path (relevant for context and conflict analysis).
- `app/api/profile/route.ts` and `components/front/profile/profile-utils.ts`: existing completion semantics (currently photo-agnostic).
- Test files likely impacted by spec tasks:
  - `tests/api/checkin-qr-bootstrap.test.ts`
  - `tests/api/checkin-qr-dropin.test.ts`
  - `tests/api/checkin-qr-package.test.ts`
  - `e2e/checkin.spec.ts`
  - `e2e/profile.spec.ts`
  - plus new unit tests for policy/camera-state modules.

## Architecture Constraints
- Reuse-first constraints are already aligned with the repo rules: no new endpoint and no DB schema change should be introduced for this feature.
- Existing auth and rate-limit protections must remain intact (`authorizeStaffPortalRequest`, `auth()`, and `consumeRateLimit` are already in critical routes).
- The check-in/onboarding flow is currently UI-heavy and centralized in `EnrollModal`; changes should stay localized and avoid unrelated refactors.
- The codebase already separates route-level validation and UI concerns; policy logic should be extracted into a shared typed resolver (as required by spec) rather than duplicated in components.
- Error logging style is currently `console.error`/`console.warn` in server routes and client handlers; new capture/upload errors should follow that pattern.

## Spec/Code Conflicts
- API contract vs current authorization boundary:
  - Spec requires reusing `PATCH /api/staff/users/[userId]/avatar`.
  - That endpoint currently requires staff-portal authorization and is not callable from customer QR/check-in flows as implemented.
  - This is a direct contract mismatch for kiosk/QR student onboarding unless a server-side bridge or auth-context adjustment is introduced.
- Context model mismatch:
  - Spec requires a single explicit `PhotoFlowContext` (`kiosk_terminal`, `qr_phone`, `external_web`).
  - Current implementation derives behavior from multiple booleans/flags and viewport heuristics in `CheckInQrClient`, with no single typed context value.
- Mandatory-photo gating missing:
  - Current check-in/new-student completion logic in `EnrollModal` has no photo requirement checks.
  - Current profile completion contracts (`app/api/profile/route.ts`, `profile-utils.ts`) do not account for avatar presence.
- Camera lifecycle requirements are currently unimplemented:
  - No `getUserMedia` usage or camera-session cleanup utility exists yet.
- Language consistency risk:
  - Some existing avatar UI messages are non-English (e.g., `"La imagen supera los 5MB."` in `ProfilePageClient`).
  - Spec requires user-facing messaging in English for this feature.

## Recommended Next Focus
1. Resolve the endpoint/auth conflict first: confirm how kiosk/QR flows can legally reuse `PATCH /api/staff/users/[userId]/avatar` under current security boundaries.
2. Introduce explicit typed context resolution (`kiosk_terminal | qr_phone | external_web`) in one shared policy module and consume it from check-in/onboarding UI.
3. Add dedicated modules from the spec (`photo-context-policy`, `camera-session`, `avatar-upload`) and keep UI components policy-free.
4. Extend `EnrollModal` (or extracted photo step component) to enforce photo-required completion only in required contexts, including retry/error states.
5. Add tests for policy rules, context-specific upload visibility, completion blocking, and camera cleanup behavior across kiosk/QR/external flows.
