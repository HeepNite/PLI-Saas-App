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
- [ ] Build an exact source/path manifest and identify production-base conflicts for the scoped release.
- [ ] Reconstruct the shareable Booking foundation on the production base in reviewable work units.
- [ ] Integrate the Heritage acquisition and staff-fulfillment lifecycle without the deferred package-credit award.
- [ ] Integrate current public package routing, promotion pricing, and corrected Clerk account access.
- [ ] Integrate and verify `/monday` through `/sunday` plus the legacy redirect.
- [ ] Prove the final executable release tree matches the intended scoped dev behavior and run focused/full checks plus independent verification.
- [ ] Create and approve the production release issue, publish bounded PRs, merge only after all required checks pass, verify the production deployment, and run a non-destructive live smoke.

## Delivery Guardrails

- Do not merge `codex/develop` wholesale.
- Do not mutate production catalog, package, student, payment, or entitlement data during release preparation or smoke verification.
- Do not use real payments for verification.
- Stop on any unexplained path outside the frozen scope or any production-base conflict that changes behavior.
