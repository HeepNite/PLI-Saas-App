# International Tablet Phone Entry - Resolution

## Resolved Outcome

All tablet phone flows will use a searchable country selector plus national-number entry and will canonicalize valid input to E.164 through one shared `libphonenumber-js/max` boundary. The implementation will preserve the existing US default and exact legacy US matching, remove unsafe international suffix matching, stop explicit identity conflicts before mutation, and reuse existing endpoints and persistence.

## Contract Decisions

| Topic | Resolution |
| --- | --- |
| Geographic scope | Support personal numbers for every country/territory returned by the installed global metadata. US, Mexico, Ecuador, Peru, Argentina, and Chile are examples only. Non-geographic service numbers are excluded. |
| Entry model | Searchable country selector plus national-number input. Empty state defaults to US. |
| Canonical form | Strict parser result `phone.number` in E.164. Local storage may remain canonical digits. |
| Validity | `libphonenumber-js/max`, whole-input parsing with `extract: false`, and `.isValid()`. Regex is not authoritative. |
| Formatting | Parser-backed national formatting with `AsYouType` or equivalent; preserve the current keypad and kiosk styling. |
| Tablet scope | New-student enrollment, returning-student identification, and tablet SMS sign-in/verification use the same domain and UI rules. |
| Existing US behavior | Default US selection, familiar national formatting, and valid US entry continue to work. |
| Legacy US rows | For parser-confirmed US phones only, exact lookup may include the exact ten-digit national number when old rows omit `1`. |
| International lookup | Exact Clerk E.164 and exact canonical-digit local/purchase matching only. No `contains`, suffix, last-ten, or inferred-US matching. |
| Identity conflicts | Different email/phone Clerk or local identities are an explicit fail-closed conflict before mutation. |
| Mutation order | Server validation and conflict resolution precede Clerk/local creation, linking, reuse, or update. |
| SMS | Clerk receives the canonical E.164 value; existing cooldown and verification behavior remains. |
| Recovery | Drafts and tickets preserve canonical E.164 including `+`. Existing recovery security policy remains. |
| Database | No schema migration or backfill. `User.phone` uniqueness remains authoritative. |
| API | No new endpoint is justified by current evidence; update existing route boundaries. |
| UI dependency | Do not add `react-phone-number-input`; reuse the kiosk keypad and create a focused repository-native field. |
| Shared calling codes | Explicit user country selection disambiguates national entry; calling code alone never changes the selected country. |
| Unresolved canonical prefill | Fail closed, do not guess or default to US, and require explicit country selection plus national-number re-entry. |
| Deployment sequence | Deploy backward-compatible canonicalization/exact matching, then deploy checkout/account conflict hardening, before connected UI sends international E.164. Accept current formatted/raw US during transition; remove suffix/substring matching and fail invalid/conflicting checkout identity before UI activation. |

## Superseded Requirements

This spec explicitly supersedes the US-only phone portions of:

- `openspec/changes/kiosk-info-sequential-focus/spec.md`
- `openspec/changes/kiosk-info-sequential-focus/design.md`
- `openspec/changes/kiosk-info-sequential-focus/proposal.md`
- `openspec/changes/kiosk-info-sequential-focus/tasks.md`

The following prior rules are replaced:

1. `isCompleteUSPhone` is no longer the tablet phone phase gate.
2. Ten entered digits are no longer the global completion rule.
3. A fixed US badge and hard-coded `+1` are no longer the only tablet country experience.
4. The prior no-new-dependency constraint is replaced by the approved, isolated `libphonenumber-js/max` dependency because global number-plan validity cannot be implemented safely with regex.

The following prior behavior remains in force:

- footer-driven phase transitions;
- phone-first terminal enrollment where currently implemented;
- inline keypad placement;
- retained values when moving between phases;
- no broad change to non-tablet enrollment solely because of this feature.

## Dependency Decision and Tradeoff

Use `libphonenumber-js/max` as the single parsing, validity, country-catalog, calling-code, and formatting source.

### Why chosen

- Global plans have variable lengths, prefixes, and allocation patterns that regex cannot maintain safely.
- `max` supports strict `.isValid()` checks required by the product decision.
- The same package runs in browser and Node, preventing client/server disagreement.
- `phone.number`, `getCountries()`, `getCountryCallingCode()`, and `AsYouType` directly support the approved contract.

### Accepted costs

- Official documentation places max metadata at approximately 145 kB.
- Strict validity can become stale when number plans change.
- Client imports must be isolated to phone-entry code and dependency updates must remain visible in review and maintenance.

### Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| Regex plus 8-to-15-digit length | Cannot prove country-specific validity and repeats the current unsafe boundary. |
| Curated country allowlist | Conflicts with approved global support. |
| `react-phone-number-input` | Adds a second UI abstraction and visual behavior without evidence that the existing keypad cannot support the UX. |
| Custom metadata | Conflicts with global support and increases maintenance burden. |
| Default/min metadata | Does not provide the approved strict digit-pattern validity contract. |

## Non-goals

- No global redesign or theme replacement.
- No rewrite of every phone field in the application.
- No migration of historical rows.
- No loosening of terminal auth, throttling, Clerk verification, recovery authorization, or uniqueness.
- No phone-based account merge automation.
- No silent correction of conflicting identities.
- No change to staff attendance, payment, or pricing behavior.
- No support for non-geographic service numbers that cannot resolve to one concrete selectable country.

## Safe Rollout Decision

The rollout is server first, not UI first:

1. Introduce the shared parser and a transitional server adapter that accepts strict canonical E.164 plus the current formatted or raw ten-digit US representations.
2. Replace last-ten, suffix, and substring lookup with exact canonical digits and the exact parser-derived US legacy candidate.
3. Harden `/api/checkout/intent`, `prepareCheckoutAccount`, and Clerk/local lookup so strict phone validation and explicit email-phone conflict detection occur before account creation, update, link, reuse, or SMS preparation.
4. Test, deploy, and verify both server slices with unchanged current US clients and canonical international route inputs.
5. Only after both deployed server boundaries pass may enrollment, `EmbeddedSignIn`, or returning-identification UI send new canonical international payloads.
6. Keep the server adapter through UI rollout so reverting connected UI does not break existing US clients.

The transition MUST NOT infer a country from arbitrary bare non-US digits. A compatibility fallback match is read-only: it MUST NOT rewrite the stored legacy row merely because it matched.

## Implementation Preconditions

- The implementation plan MUST preserve exact endpoint authorization and rate limits.
- Tests MUST prove parser parity in browser-facing and server-facing code.
- The exact US legacy candidate builder MUST be isolated and unit-tested.
- Tests MUST prove a legacy US compatibility match does not update the stored phone merely because it matched.
- Conflict tests MUST run before any mutation-mock assertion.
- Parser or metadata exceptions MUST be caught at every mutating server boundary and fail closed before mutation.
- Checkout/account conflict hardening MUST have deployment evidence before any connected international tablet UI activation.
- Any evidence that a new endpoint or schema change is unavoidable MUST return to requirements/resolution before implementation.
