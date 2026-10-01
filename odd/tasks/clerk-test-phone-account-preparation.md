# Clerk Test Phone Account Preparation

## Goal
Restore Clerk fictional phone support in the guarded `codex/develop` preview account-preparation flow.

## Constraints
- Keep the exception restricted to Vercel Preview, `codex/develop`, and Clerk test credentials.
- Do not broaden production phone acceptance.
- Do not write to Clerk, Railway, or production while validating the code fix.

## Tasks
- [x] Reproduce and identify the contradictory phone parsers in account preparation.
- [x] Use the guarded server phone parser consistently when persisting an exact prepared identity.
- [x] Add regression coverage for a guarded `+1 555-555-01xx` account.
- [x] Run focused tests, typecheck, scoped lint, and diff checks.

## Evidence
- The deployed `/api/checkin/qr/new-student/verify` accepts `+15555550123` and returns `requires_sms_verification`.
- `ensureExactAccountIdentity` accepts the number through `parseServerPhoneInput`, but `createCheckoutExactAccountDependencies.upsertLocalIdentity` reparsed it with `parseCanonicalPhone`, rejected it, and returned `CONTACT_DETAILS_UNAVAILABLE` after Clerk mutation.
- The new regression test failed before the fix with `Canonical phone became invalid` and passes after using `parseServerPhoneInput` consistently.
- Focused regression suite: 3 files, 52 tests passed.
- `npm run typecheck`, scoped ESLint, and `git diff --check` passed.
- Native reliability review `review-a333b8b0cc3cf747` approved and acknowledged.
