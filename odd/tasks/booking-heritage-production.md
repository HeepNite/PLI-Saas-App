# Booking and Heritage Production Release

## Goal

Promote the verified public Booking and Heritage experience from `codex/develop` to production without merging unrelated development work.

## Frozen Scope

- Public `/booking` class discovery and booking handoff.
- Heritage country selection, paid-purchase pin acquisition, and staff fulfillment.
- Public package routing as currently deployed on dev.
- Server-authoritative public booking pricing and required course-promotion support.
- Corrected Clerk phone/email account access.
- Static `/monday` through `/sunday` routes and the legacy Monday redirect.

## Explicit Deferrals

- A package-credit reservation does not yet award a Heritage pin.
- The Full-package seven-day extension is deferred.
- The 5/8-class package attendance reward and deferred bonus-credit ledger are deferred.
- Profile-origin pin acquisition remains excluded.
- Unrelated `codex/develop` changes must not enter this release.

## Release Baselines

- Production base: `origin/main` at `4d5f4ea72648fa8876f3d6fbccb61b5a48e82180`.
- Verified dev source: `origin/codex/develop` at `335b894ef9060ae49b500f2cb7fcaf4976afb72d`.
- Release branch: `feat/booking-heritage-production`.
- Every production PR must remain below the repository 400-line review limit, link an approved release issue, and carry exactly one `type:*` label.

## Tasks

- [x] Create the isolated production-release worktree and freeze release/deferred scope.
  - Worktree: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/booking-heritage-production-release`.
  - Commit: `5ece79a0` (`docs(odd): track booking production release`).
- [x] Build an exact source/path manifest and identify production-base conflicts for the scoped release.
  - Source groups: public Booking foundation (#506); Heritage contract/domain/UI/checkout/staff lifecycle (#551–#559); campaign and identity corrections (#560–#570, excluding unrelated gaps); package routing (#572–#576); booking/identity recovery (#583, #588, #594–#595, #598–#602); public promotion pricing (#608–#621); Clerk email/phone access (#629–#630); weekday routes (#632–#633).
  - Explicitly excluded: dev-only Clerk test-phone persistence (#581), profile-only promotion quote work (#622–#627), package-credit pin awards, package reward ledger, and unrelated dev changes.
  - Assembly rule: replay each selected PR's first-parent delta in chronological order. Do not copy the current dev files wholesale because current shared files import excluded profile-quote and special-class modules.
  - The selected historical deltas touch 149 unique paths and total roughly 12,400 changed lines against current production, so the hard 400-line PR gate requires a long chained release; the oversized #506 foundation must be re-sliced.
  - Production overlap requiring manual reconciliation: `app/api/checkout/cash/route.ts`, staff payment presentation/types, `lib/phone/index.ts`, and their focused tests. Preserve main's cash sale-day, payment-debt, and strict international-phone fixes.
  - Commit: `c68f1355` (`docs(release): map booking production scope`).
- [ ] Reconstruct the shareable Booking foundation on the production base in reviewable work units.
- [ ] Integrate the Heritage acquisition and staff-fulfillment lifecycle without the deferred package-credit award.
- [ ] Integrate current public package routing, promotion pricing, and corrected Clerk account access.
- [ ] Integrate and verify `/monday` through `/sunday` plus the legacy redirect.
- [ ] Prove the final executable release tree matches the intended scoped dev behavior and run focused/full checks plus independent verification.
- [ ] Create and approve the production release issue, publish bounded PRs, merge only after all required checks pass, verify the production deployment, and run a non-destructive live smoke.

## Source PR Manifest

- Foundation: #506 (must be re-sliced below 400 lines).
- Heritage lifecycle: #551, #552, #553, #554, #555, #556, #557, #558, #559.
- Campaign/booking corrections: #560, #561, #562, #566, #567, #568, #569, #570.
- Package routing: #572, #573, #574, #575, #576.
- Identity and campaign recovery: #583, #588, #594, #595, #598, #599, #600, #601, #602.
- Public promotion pricing: #608 through #621.
- Clerk account access: #629 and #630.
- Weekday routes: #632 and #633.

## Delivery Guardrails

- Do not merge `codex/develop` wholesale.
- Do not mutate production catalog, package, student, payment, or entitlement data during release preparation or smoke verification.
- Do not use real payments for verification.
- Stop on any unexplained path outside the frozen scope or any production-base conflict that changes behavior.
