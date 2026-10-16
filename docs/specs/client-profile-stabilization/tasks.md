# Client Profile Stabilization — Tasks

## Delivery sequence

- [x] 1. Reconcile accepted behavior with current `codex/develop` and record requirements, analysis, decisions, and design.
- [x] 2. Correct New York timestamp construction and booked-class calendar visibility using test-first changes.
- [x] 3. Restore the profile-completion modal and remove unused profile sections from composition.
- [x] 4. Integrate the approved eleven-country phone flow into public booking and identity boundaries.
- [ ] 5. Resolve wizard interaction decisions, then implement it over the existing profile form contract.
- [ ] 6. Run integrated Development verification, remove the controlled fixture, and prepare bounded delivery slices.

## Review boundaries

| Task | Primary review concern | Must remain unchanged |
| --- | --- | --- |
| 2 | Correct instant/date projection and visible booking events | Auth, package ownership, capacity and duplicate guards |
| 3 | Prompt gating and profile composition | Profile API and reusable removed-section components |
| 4 | E.164 country-aware entry and identity safety | Existing Clerk ownership checks, rate limits, checkout authority |
| 5 | Wizard navigation and validation | `ProfileFormState`, completion semantics and `PUT /api/profile` |
| 6 | Cross-flow regression and cleanup evidence | Production aliases and production data |

## Verification ledger

Record commands, runtime observations, commit identities, skipped checks, and fixture cleanup evidence in `odd/tasks/client-profile-stabilization.md` after each work unit.
