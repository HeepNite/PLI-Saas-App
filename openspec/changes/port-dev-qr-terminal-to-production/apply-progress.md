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

---

## Scope — PR3 partial slice
- Delivery mode: `auto-chain`
- Chain strategy: `feature-branch-chain`
- Current slice: `PR3 package/drop-in parity`
- Current work-unit boundary: `2.3–2.4 plus 2.7 helper refactor`
- Changed-line budget: `390`
- Authored changed lines in this slice: `282` (code/tests before apply artifacts)
- Total native-attempt changed lines: `346` (code/tests + OpenSpec artifacts)
- Budget result: `346/390`, passed; consecutive-offer tasks 2.5–2.6 deferred to keep the slice reviewable

## Newly Completed Tasks
- [x] 2.3 RED package/drop-in parity regressions
- [x] 2.4 GREEN package/drop-in route parity
- [x] 2.7 REFACTOR shared QR action-window helper reuse

## TDD Cycle Evidence — PR3 partial
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 2.3 | `tests/api/checkin-qr-package.test.ts`, `tests/api/checkin-qr-dropin.test.ts` | API (mocked Vitest route harness) | `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts` → 2 files, 17/17 passed (truthful pre-change-equivalent safety net for the files touched in this slice) | Expanded diagnostic command `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` failed in 5 places after adding new assertions and before route changes; this was the RED signal, not the safety net | `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` → 3 files, 23/23 passed after package/drop-in parity changes | Added stale Clerk fallback, regular-vs-consecutive window, duplicate/idempotent purchase, and kiosk continuation cases to force the distinct package/drop-in paths | Route logic stayed minimal; helper extraction deferred to 2.7 |
| 2.4 | `tests/api/checkin-qr-package.test.ts`, `tests/api/checkin-qr-dropin.test.ts` | API (mocked Vitest route harness) | `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts` → 2 files, 17/17 passed | Covered by 2.3 RED diagnostic run before production changes | `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts` → 2 files, 17/17 passed | Package route now restores safe Clerk fallback and separate consecutive window handling; drop-in route reuses the shared window helper without behavior drift | Minimal route changes only |
| 2.7 | `tests/api/checkin-qr-package.test.ts`, `tests/api/checkin-qr-dropin.test.ts` | API approval tests | `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts` → 2 files, 17/17 passed before helper extraction | Refactor-only task — approval coverage from 2.3 served as the behavior lock; no additional failing behavior was introduced or required | `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts` → 2 files, 17/17 passed after extracting the helper | Reused the same package/drop-in matrix to prove no behavior drift across both standard and terminal windows | Extracted `lib/checkin/qr.ts::isQrActionWindowAllowed` and reused it in both routes; tests remained green before and after extraction |

## Work Unit Evidence — PR3 partial
| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` → passed, 3 files / 23 tests |
| Runtime harness command/scenario and exact result | `N/A` — user explicitly prohibited live production-backed flows; this slice is proven with mocked Vitest route harnesses only |
| Rollback boundary | Revert `app/api/checkin/qr/package/route.ts`, `app/api/checkin/qr/dropin/route.ts`, `lib/checkin/qr.ts`, `tests/api/checkin-qr-package.test.ts`, and `tests/api/checkin-qr-dropin.test.ts` only |

## Verification Commands — PR3 partial
- `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` → RED captured before production changes; current GREEN result is 3 files / 23 tests after package/drop-in parity fixes (the earlier 26-test count was corrected during evidence reconciliation)
- Corrective retry: `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts` → passed, 2 files / 17 tests (truthful safety net for this slice)
- Corrective retry: `npm test -- tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` → passed, 3 files / 23 tests (current focused package/drop-in matrix plus unaffected consecutive-offer approval coverage)
- Prior broader regression evidence from the initial PR3 verification: `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` → passed, 7 files / 59 tests
- `npx eslint "app/api/checkin/qr/package/route.ts" "app/api/checkin/qr/dropin/route.ts" "lib/checkin/qr.ts" "tests/api/checkin-qr-package.test.ts" "tests/api/checkin-qr-dropin.test.ts"` → passed
- `npm run typecheck` → passed
- `npm run build` → passed (repo still has unrelated pre-existing warnings)
- `git diff --check` → passed

## Files Touched — PR3 partial
- `app/api/checkin/qr/package/route.ts` — restored safe Clerk fallback and split regular vs consecutive window handling
- `app/api/checkin/qr/dropin/route.ts` — reused the shared QR action-window helper while preserving purchase validation behavior
- `lib/checkin/qr.ts` — extracted shared QR action-window helper for route parity reuse
- `tests/api/checkin-qr-package.test.ts` — added stale Clerk fallback and normal-vs-consecutive window regressions
- `tests/api/checkin-qr-dropin.test.ts` — added standard-vs-terminal window regressions for drop-in continuation

## Remaining Tasks
- [ ] 2.5 RED terminal consecutive-offer throttling/filtering
- [ ] 2.6 GREEN terminal consecutive-offer throttling/filtering
- [ ] Phase 3 tasks 3.1–3.3
- [ ] Phase 4 tasks 4.1–4.2

## Status
- Phase 1 and PR2 bootstrap work remain complete.
- This child slice is partial: tasks 2.3, 2.4, and 2.7 are complete; 2.5–2.6 remain for the next bounded PR because completing them here would push the slice over the 390-line cap once artifacts are included.

---

## Scope — PR4 consecutive-offer safety
- Delivery mode: `auto-chain`
- Chain strategy: `feature-branch-chain`
- Current slice: `PR4 consecutive-offer safety`
- Current work-unit boundary: `2.5–2.6 terminal consecutive-offer rate-limit/filtering`
- Changed-line budget: `220`
- Authored changed lines in this slice: `149` (code/tests before apply artifacts)
- Total native-attempt changed lines: `202` (code/tests + OpenSpec artifacts)
- Budget result: `202/220`, passed

## Newly Completed Tasks
- [x] 2.5 RED terminal consecutive-offer throttling/filtering regressions
- [x] 2.6 GREEN terminal consecutive-offer rate limiting + same-day/current-time filtering

## TDD Cycle Evidence — PR4
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 2.5 | `tests/api/checkin-terminal-consecutive-offer.test.ts` | API (mocked Vitest route harness) | Existing PR1-PR3 regression matrix: `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` → passed, 7 files / 64 tests | `npm test -- tests/api/checkin-terminal-consecutive-offer.test.ts` → failed, 4 assertions before route changes (`429`, wrong-day, invalid-source-time, already-ended linked class) | `npm test -- tests/api/checkin-terminal-consecutive-offer.test.ts` → passed, 1 file / 10 tests | Added rate-limit, same-day, invalid source time, and ended-today offer suppression cases | Reused existing ET/date + rate-limit helpers; no extra runtime files |
| 2.6 | `tests/api/checkin-terminal-consecutive-offer.test.ts` | API (mocked Vitest route harness) | Same matrix as 2.5 | Covered by the 2.5 RED run before production changes | `npm test -- tests/api/checkin-terminal-consecutive-offer.test.ts` → passed, 1 file / 10 tests | Verified route returns `429`, rejects non-today/invalid-time requests, and suppresses ended linked classes while preserving valid same-day offers | Kept changes inside the existing route only |

## Work Unit Evidence — PR4
| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm test -- tests/api/checkin-terminal-consecutive-offer.test.ts` → passed, 1 file / 10 tests |
| Runtime harness command/scenario and exact result | `N/A` — user required mocked tests only; no live/runtime harness permitted for this slice |
| Rollback boundary | Revert `app/api/checkin/terminal/consecutive-offer/route.ts`, `tests/api/checkin-terminal-consecutive-offer.test.ts`, and the 2.5–2.6 checkbox/apply-progress artifact updates only |

## Verification Commands — PR4
- `npm test -- tests/api/checkin-terminal-consecutive-offer.test.ts` → RED captured first (4 failing assertions), then GREEN passed, 1 file / 10 tests
- `npm test -- tests/checkin/checkin-bootstrap-context.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` → passed, 7 files / 64 tests
- `npx eslint "app/api/checkin/terminal/consecutive-offer/route.ts" "tests/api/checkin-terminal-consecutive-offer.test.ts"` → passed
- `npm run typecheck` → passed
- `npm run build` → passed (with unrelated existing warnings)
- `git diff --check` → passed

## Files Touched — PR4
- `app/api/checkin/terminal/consecutive-offer/route.ts` — added route throttling plus same-day, valid-source-time, and linked-class-not-ended filtering using existing helpers
- `tests/api/checkin-terminal-consecutive-offer.test.ts` — added RED coverage for rate limiting and invalid same-day/current-time offer cases

## Remaining Tasks
- [ ] Phase 3 tasks 3.1–3.3
- [ ] Phase 4 tasks 4.1–4.2

## Status
- Phase 2 is now complete through tasks 2.1–2.7.
- Ready for the next chained batch (Phase 3) or verification scheduling.
