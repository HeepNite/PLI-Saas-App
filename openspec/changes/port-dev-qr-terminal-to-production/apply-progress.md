# Apply Progress: port-dev-qr-terminal-to-production

## Scope
- Delivery mode: `auto-chain`
- Chain strategy: `feature-branch-chain`
- Current slice: `PR1 auth resume`
- Changed-line budget: `220`
- Authored changed lines in this slice: `150` (code/tests only)
- Total native-attempt changed lines: `208` (includes SDD apply artifacts)
- Budget result: `208/220`, passed

## Completed Tasks
- [x] 1.1 RED `tests/checkin/checkin-bootstrap-context.test.ts`
- [x] 1.2 GREEN sign-in QR redirect wiring
- [x] 1.3 REFACTOR `lib/checkin/qr-auth-resume.ts`

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `tests/checkin/checkin-bootstrap-context.test.ts` | Unit | `npm test -- tests/checkin/qr-booking-links.test.ts` → 1 file, 5/5 passed | `npm test -- tests/checkin/checkin-bootstrap-context.test.ts` → failed: `Cannot find package '@/lib/checkin/qr-auth-resume'` | `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts` → 2 files, 12/12 passed | Happy path + unsafe URL + malformed/missing param + ordinary sign-in fallback cases | Helper extracted and reused |
| 1.2 | `tests/checkin/checkin-bootstrap-context.test.ts` | Unit | `npm test -- tests/checkin/qr-booking-links.test.ts` → 1 file, 5/5 passed | Included in 1.1 RED before production code | `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts` → 2 files, 12/12 passed | Added valid forced redirect and unsafe/missing fallback assertions on `SignInPage` props | Minimal page wiring; no `CheckInPageRouter` edit |
| 1.3 | `tests/checkin/checkin-bootstrap-context.test.ts`, `tests/checkin/qr-booking-links.test.ts` | Unit | `npm test -- tests/checkin/qr-booking-links.test.ts` → 1 file, 5/5 passed | Included in 1.1 RED before helper existed | `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts` → 2 files, 12/12 passed | Valid complete context + invalid fallback-to-plain-sign-in cases | Validation stays single-purpose |

## Work Unit Evidence
| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts` → passed, 2 files / 12 tests |
| Runtime harness command/scenario and exact result | `node scripts/run-playwright.mjs e2e/checkin.spec.ts` → failed, 4/4 red before auth-resume assertions; current harness expects outdated `/checkin` UI and never reached sign-in resume |
| Rollback boundary | Revert `app/(auth)/sign-in/page.tsx`, `lib/checkin/qr-auth-resume.ts`, `lib/checkin/qr-booking-links.ts`, `tests/checkin/checkin-bootstrap-context.test.ts`, and `tests/checkin/qr-booking-links.test.ts` only |

## Verification Commands
- `npm test -- tests/checkin/qr-booking-links.test.ts` → passed, 1 file / 5 tests
- `npm test -- tests/checkin/checkin-bootstrap-context.test.ts` → RED captured before implementation (`Cannot find package '@/lib/checkin/qr-auth-resume'`)
- `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts` → passed, 2 files / 12 tests
- `npx eslint "app/(auth)/sign-in/page.tsx" "lib/checkin/qr-auth-resume.ts" "lib/checkin/qr-booking-links.ts" "tests/checkin/checkin-bootstrap-context.test.ts" "tests/checkin/qr-booking-links.test.ts"` → passed
- `npm run typecheck` → passed
- `npm run build` → passed
- `git diff --check` → passed

## Files Touched
- `app/(auth)/sign-in/page.tsx` — validated `redirect_url` server-side and only passes safe `/checkin` paths to Clerk `forceRedirectUrl`
- `lib/checkin/qr-auth-resume.ts` — central QR auth-resume validator
- `lib/checkin/qr-booking-links.ts` — reuses the helper so incomplete/unsafe contexts fall back to plain sign-in
- `tests/checkin/checkin-bootstrap-context.test.ts` — safe QR resume + Clerk fallback coverage
- `tests/checkin/qr-booking-links.test.ts` — stricter sign-in link expectations

## Remaining Tasks
- [ ] Phase 2 tasks 2.1–2.7
- [ ] Phase 3 tasks 3.1–3.3
- [ ] Phase 4 tasks 4.1–4.2

## Status
- Phase 1 complete for PR1.
- Browser runtime verification still needs a QR-resume-accurate harness; the current `e2e/checkin.spec.ts` is stale against the present `/checkin` UI.

---

## Scope — PR2 partial slice
- Delivery mode: `auto-chain`
- Chain strategy: `feature-branch-chain`
- Current slice: `PR2 required journey hardening`
- Current work-unit boundary: `2.1–2.2 bootstrap journey hardening only`
- Changed-line budget: `390`
- Authored changed lines in this slice: `278` (code/tests before apply artifacts)
- Total native-attempt changed lines: `336` (code/tests + OpenSpec artifacts)
- Budget result: `336/390`, passed; package/drop-in + consecutive-offer work deferred to keep PR2 reviewable

## Newly Completed Tasks
- [x] 2.1 RED `tests/api/checkin-qr-bootstrap.test.ts` + existing `tests/api/checkin-qr-client-phone.test.ts` coverage for new user, package holder, non-package client, unknown course, and stale Clerk fallback
- [x] 2.2 GREEN `app/api/checkin/qr/bootstrap/route.ts` local bootstrap parity + safe Clerk identity fallback

## TDD Cycle Evidence — PR2 partial
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 2.1 | `tests/api/checkin-qr-bootstrap.test.ts`, `tests/api/checkin-qr-client-phone.test.ts` | API (mocked Vitest route harness) | `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` → pre-existing failures in untouched PR2 files; continued with the bootstrap-focused harness after isolating the current work unit | `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts` → failed on new bootstrap journey and stale Clerk fallback assertions before route changes | `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts` → 4 files, 35/35 passed | Added explicit new-user, eligible-package, purchase-first, unknown-course, stale-kiosk-clerk-id, and existing PR1/client-phone regression assertions | Shared fallback wiring kept inside the existing bootstrap route; wider dedupe deferred to remaining Phase 2 tasks to stay under the 390-line cap |
| 2.2 | `tests/api/checkin-qr-bootstrap.test.ts` | API (mocked Vitest route harness) | Same focused harness as 2.1 | Covered by the 2.1 RED run before production changes | `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts` → 4 files, 35/35 passed | Verified bootstrap parity across no-package, package-holder, and purchase-first branches plus stale Clerk identity recovery | `lib/checkin/qr-decision.ts` remained behaviorally compatible; deeper shared-helper refactor deferred with 2.3–2.7 |

## Work Unit Evidence — PR2 partial
| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts` → passed, 4 files / 35 tests |
| Runtime harness command/scenario and exact result | `N/A` — user explicitly prohibited live production-backed flows; this partial slice is proven with mocked Vitest route harnesses only |
| Rollback boundary | Revert `app/api/checkin/qr/bootstrap/route.ts` and `tests/api/checkin-qr-bootstrap.test.ts` only; PR1 auth-resume files remain untouched |

## Verification Commands — PR2 partial
- `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts tests/api/checkin-qr-package.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` → RED captured before narrowing to the cap-safe bootstrap slice; bootstrap fallback and remaining PR2 tasks were failing
- `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts` → passed, 4 files / 35 tests
- `npx eslint "app/api/checkin/qr/bootstrap/route.ts" "tests/api/checkin-qr-bootstrap.test.ts"` → passed
- `npm run typecheck` → passed
- `npm run build` → passed (repo has unrelated existing warnings)
- `git diff --check` → passed

## Files Touched — PR2 partial
- `app/api/checkin/qr/bootstrap/route.ts` — restored safe Clerk identity fallback while preserving local bootstrap decision parity and terminal payload behavior
- `tests/api/checkin-qr-bootstrap.test.ts` — added bootstrap branch coverage for new users, eligible packages, purchase-first fallback, unknown course, and stale Clerk recovery

## Remaining Tasks
- [ ] 2.3 RED package/drop-in/consecutive route regressions
- [ ] 2.4 GREEN package/drop-in route parity
- [ ] 2.5 RED terminal consecutive-offer throttling/filtering
- [ ] 2.6 GREEN terminal consecutive-offer throttling/filtering
- [ ] 2.7 REFACTOR shared QR decision helpers
- [ ] Phase 3 tasks 3.1–3.3
- [ ] Phase 4 tasks 4.1–4.2

## Status
- Phase 1 remains complete for PR1.
- PR2 is partial: tasks 2.1–2.2 are complete; 2.3–2.7 were intentionally deferred to stay inside the 390-line cap.
