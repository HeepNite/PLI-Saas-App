# International Phone Entry Resolution

## Resolved decisions

| Topic | Decision |
| --- | --- |
| Active specification | Continue `docs/specs/international-tablet-phone-entry/`; no competing phone specification is created. |
| First slice | Special Salsa reservation is Work Unit 1 because it is time-critical for this Sunday. |
| Entry model | Shared country selector plus national-number input; US is the empty-draft default. |
| Minimum countries | US, MX, and AR must be selectable; the catalog is metadata-backed and not limited to those three. |
| Canonical form | Strict parser-owned E.164; local compatibility uses canonical digits only where the existing storage contract requires it. |
| Parsing | `libphonenumber-js/max`, explicit selected country for national input, `extract: false`, and strict validity. |
| Lookup | Exact Clerk E.164 and exact local/purchase canonical digits. A parser-derived ten-digit legacy candidate applies only to valid US input. |
| Conflicts | Independent email/phone lookups; any disagreement or ambiguity fails closed before mutation. |
| UI reuse | Repository-native controlled field plus existing kiosk keypad. Do not add `react-phone-number-input`. |
| Rollout | Server-safe parsing and exact identity boundaries deploy before each connected UI activation; Special Salsa includes its required checkout identity boundary in its first slice. |

## Reconciled current-state evidence

- On `origin/main`, `SpecialSalsaClassLanding` currently requires a manually prefixed E.164 value with a regex, while `lib/checkout/special-class-identity.ts` only strips digits and accepts a prefix if the raw input starts with `+`.
- The actual Special Salsa route is `app/special-salsa-class/page.tsx`; it renders `SpecialSalsaClassExperience` then `SpecialSalsaClassLanding`.
- The current Special Salsa video already starts playback only when reduced motion is not requested, has `autoPlay`, and exposes play/pause and mute controls. No autoplay correction belongs in this phone specification.
- General flows remain US-centric: `formatUSPhone`, `isCompleteUSPhone`, `KioskPinModal`, `EmbeddedSignIn`, and `normalizePhone` impose or propagate US/digits-only behavior.
- A dedicated worktree contains the earlier international phone specification and implementation foundation. This plan adopts its single specification identity, but implementation must verify the chosen branch/base before reusing code; no unmerged worktree is treated as deployed behavior.

## Explicit non-decisions

- No migration, backfill, new endpoint, new phone UI package, changes to Special Salsa autoplay, or change to existing security/payment policies.
- Non-geographic/unresolved numbers are rejected for this personal-number entry feature.

## Implementation gates

1. The Special Salsa slice may activate only when its shared parser, special checkout identity resolution, and tests prove no invalid/conflicting number can reach Clerk/local mutation or a hold.
2. Broader UI activation requires the corresponding server lookup/checkout/recovery boundary to be deployed and verified first.
3. Any discovered phone surface with a distinct contract must be added to this specification before implementation, not handled ad hoc.
