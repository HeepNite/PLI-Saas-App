# Public booking package routing

## Goal

Restore package-aware behavior in the public booking journey without changing new-student pricing:

- verified new customer with no purchase/package history: US$15;
- existing customer without an applicable package: regular US$20;
- existing customer with an applicable active package: reserve the selected class against that package;
- reserve package capacity at booking, but finalize credit consumption only when the class is completed;
- Heritage pin state has no pricing or package authority.

## Evidence

- Railway `PLI-SaaS / Postgres-g1Qy` read-only audit confirmed demo suffix `0103` has three successful purchases and active `first-groove` package with 4/5 credits for `salsa-night-beginner`.
- `app/api/checkin/qr/new-student/eligibility/route.ts` correctly classifies any successful purchase or package holder as existing.
- Public `CourseAsideRight` routes existing users to regular checkout but does not resolve an applicable owned package.
- Existing profile package booking APIs reserve and decrement credits immediately; this does not match the clarified completion-time consumption contract.

## Tasks

- [x] 1. Reconcile requirements and design for public package booking and deferred credit consumption.
  - Evidence: Heritage and shareable-booking requirements/design now separate physical pins from pricing and define package holds, completion consumption, and cancellation release.
- [x] 2. Add failing policy/API tests for new US$15, existing US$20, applicable-package booking, reservation safety, and completion-time consumption.
  - Evidence: focused RED captured missing hold/consume/release helpers and package-booking service; new API, domain, and hook coverage added.
- [x] 3. Implement server-authoritative package resolution, booking reservation, completion consumption, and cancellation release.
  - Evidence: authenticated reservation endpoint ignores caller package IDs, resolves applicable ownership, creates scheduled zero-delta holds, blocks oversubscription, consumes held finite credits on attended transition, and releases holds/restores consumed credits on removal.
- [x] 4. Route the public booking UI through package booking when applicable while preserving the contact step and regular checkout fallback.
  - Evidence: signed-in existing public bookings try package reservation before hosted checkout; successful reservations skip payment, while no-package/no-credit results retain regular checkout. Physical pin pricing and copy were removed.
- [x] 5. Run focused tests, typecheck, scoped lint, diff-size check, and native review; record all evidence.
  - Evidence: 11 focused files / 138 tests passed; `npm run typecheck` passed; scoped ESLint reported 0 errors; `git diff --check` passed; native review `review-aefed6343e9d5ffa` approved after four critical reliability corrections.

## Work evidence

The 1,295-line candidate was split into five reviewable work units below the unconditional 400-line limit:

1. `f7c96e47` — `fix(campaign): decouple Heritage pins from pricing` — 330 changed lines.
2. `bc682f36` — `feat(packages): add deferred credit holds` — 246 changed lines.
3. `728e5a22` — `fix(attendance): finalize held package credits` — 160 changed lines.
4. `d71642cd` — `feat(booking): reserve classes with active packages` — 315 changed lines.
5. `80d2f3e9` — `feat(booking): route package holders past checkout` — 256 changed lines.

Focused verification command: `npx vitest run` over the 11 affected API, campaign, enrollment, attendance, package-domain, and public-package-booking files; exact result: 11 files and 138 tests passed. Static verification: `npm run typecheck` and `git diff --check` passed. Scoped ESLint completed with zero errors; existing warnings remain informational.

Runtime harness: N/A for the final package-holder browser journey because the six Clerk/Railway demo identities were intentionally deleted and no SMS, Stripe transaction, deployment, or remote mutation was authorized for this verification step.

Rollback boundaries are independent by work unit: revert pin-pricing removal, package hold primitives, attendance finalization, reservation service, or enrollment routing using the corresponding commit above. Delivery strategy is a five-slice Feature Branch Chain; branch topology, push, PR creation, deployment, SMS, Stripe transactions, and further remote writes remain unauthorized.
