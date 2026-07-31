# Proposal: Port Dev QR Terminal to Production

## Intent
Restore production parity with the dev `/staff/terminal` QR customer journey. Production must resume the scanned QR context after authentication and complete the correct onboarding, package, or purchase flow without weakening existing security, entitlement, or terminal-completion contracts.

## Scope

### In Scope
- Port the missing dev auth-resume contract so sign-in returns users to the original `/checkin` QR context.
- Port the missing dev QR decision and check-in contracts needed for the three journeys: new user, existing client with usable package, existing client without usable package.
- Add automated regression coverage for QR auth resume and each journey; define reviewable vertical slices for delivery forecasting.

### Out of Scope
- Wholesale cherry-pick of all dev terminal commits.
- New schema or migration work unless later evidence proves it unavoidable.

## Capabilities

### New Capabilities
- `qr-terminal-auth-resume`: Preserve QR class context through authentication and resume the original terminal flow.
- `qr-terminal-customer-journeys`: Drive correct bootstrap, package, and drop-in decisions for all three QR customer journeys.
- `qr-terminal-completion-and-offers`: Preserve terminal completion behavior, safe entitlement consumption, and consecutive-offer handling.

### Modified Capabilities
- None.

## Approach
Use a targeted port of missing dev contracts onto `origin/main`, not a blind cherry-pick. Keep gateway delegation config-gated: parity MUST work through existing local fallback paths, with optional `NEST_GATEWAY_*` behavior deferred unless proven essential. Delivery should stay reviewable via vertical slices: auth resume, journey contract hardening, then optional gateway parity if still required.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(auth)/sign-in/page.tsx` | Modified | Restore forced QR return after auth. |
| `app/api/checkin/qr/*.ts` | Modified | Port bootstrap/package/drop-in journey parity. |
| `app/api/checkin/terminal/*.ts` | Modified | Preserve completion and consecutive-offer rules. |
| `lib/checkin/qr-decision.ts` | New/Modified | Reuse shared decision logic if needed for parity. |
| `tests/api/checkin-*.test.ts` | Modified | Add regressions for auth resume and all journeys. |
| Prisma models | Modified behavior only | `Purchase`, `PackagePurchase`, `Attendance`, `ClassSession`, `CourseLink`, `StaffTerminal`, `StaffTerminalSession`; no migration proposed. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Resume fix masks deeper contract drift | Med | Port and test full journeys, not only redirect. |
| Package/drop-in parity breaks credit safety or duplicate guards | Med | Reuse existing transactional and validation paths; add regressions. |
| Gateway behavior leaks into required parity scope | Low | Keep fallback-first behavior and defer activation unless essential. |

## Rollback Plan
Revert the QR terminal parity slices in reverse order and keep production on the current local-fallback contract; no data rollback is expected because no schema change is proposed.

## Dependencies

- `origin/codex/develop` `/staff/terminal` behavior as source of truth.
- Existing Clerk auth, rate limiting, course/date/time validation, duplicate protection, and atomic reservation flows.

## Success Criteria

- [ ] New users can scan QR and complete the correct onboarding/booking flow with class context preserved.
- [ ] Existing clients with a usable package resume QR context after auth, consume entitlement safely, and reach the intended completion/consecutive-offer outcome.
- [ ] Existing clients without a usable package resume QR context, complete the correct purchase/check-in path, and automated regressions cover all journeys plus auth resume.
