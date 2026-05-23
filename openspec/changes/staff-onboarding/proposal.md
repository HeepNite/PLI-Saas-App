# Proposal: Staff Onboarding Flow

## Intent
Replace Clerk's branded invitation email with a fully PLI-branded onboarding experience. Today, new staff receive a Clerk invitation (off-brand) and existing users get a silent metadata flip with no notification. Both paths should funnel through a single unique welcome link that feels 100% native to the PLI system and lets the user self-select their PIN.

## Scope

### In Scope
- Prisma `StaffOnboardingToken` model + migration (token hash, email, role, category, expiry, consumed).
- Modify `POST /api/staff/users` to generate a token and return the onboarding URL instead of issuing a Clerk invitation.
- New server-rendered page `/staff/welcome?token=xxx` with branded copy and role context.
- Render `EmbeddedSignUp` (new user) or `EmbeddedSignIn` (existing user) based on token state.
- PIN self-selection step (4-digit) inside the welcome flow.
- New endpoint `POST /api/staff/onboarding/consume` for token validation, role assignment, PIN hashing, and `StaffAccount` sync.
- Refactor duplicated `hashPin` into a shared util.

### Out of Scope
- Automated email delivery (admin copies the link manually for now).
- Custom branded email templates.
- Multi-organization onboarding.

## Capabilities

### New Capabilities
- `staff-onboarding`: Branded, token-gated onboarding flow that promotes a user to staff, captures a self-chosen PIN, and binds Clerk identity to PLI roles without leaving PLI's UI.

### Modified Capabilities
- None (no prior `openspec/specs/` capabilities exist).

## Approach
1. Add `StaffOnboardingToken` to Prisma; store SHA-256 of the raw token, never plaintext.
2. `POST /api/staff/users` creates the token, returns `{ onboardingUrl }` to the admin portal.
3. `/staff/welcome` (server component) validates the token, branches on `token.clerkUserId` to mount `EmbeddedSignUp` or `EmbeddedSignIn`.
4. After auth, render the PIN step; submit raw token + PIN to `POST /api/staff/onboarding/consume`.
5. Consume endpoint: match session email to token email, apply Clerk role metadata, hash PIN via shared util, upsert `StaffAccount`, write audit log, mark token consumed.
6. Redirect to `/staff/resolve` → portal.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| Prisma schema | Add | New `StaffOnboardingToken` model + migration |
| `POST /api/staff/users` | Modify | Replace Clerk invite logic with token generation |
| `/staff/welcome` page | Add | New branded server component |
| `POST /api/staff/onboarding/consume` | Add | Token validation + role assignment endpoint |
| `EmbeddedSignUp` / `EmbeddedSignIn` | Reuse | Mounted inside welcome page |
| PIN hashing util | Refactor | Deduplicate `hashPin` into shared module |
| Admin staff UI | Modify | Display generated onboarding URL for copy |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Token brute force | Low | 128-bit entropy + rate limit on consume endpoint |
| Wrong user consumes token | Medium | Enforce session email == token email |
| `EmbeddedSignUp` does not set active session | Medium | Handle `setActive` client-side, validate session server-side on consume |
| Logged-in user collides with token identity | Medium | Detect mismatch and prompt sign-out before continuing |
| Token leakage via URL/logs | Low | Hash at rest, short expiry, single-use |

## Rollback Plan
Revert the change set: drop migration, restore prior `POST /api/staff/users` Clerk-invite logic, remove `/staff/welcome` and consume endpoint. Existing staff are unaffected because tokens are additive.

## Dependencies
- Clerk SDK (existing) for `EmbeddedSignUp`/`EmbeddedSignIn` and session APIs.
- Prisma + migration tooling.
- Existing PIN hashing logic (to be unified).
- Existing audit logging utilities.

## Success Criteria
- [ ] Admin promotes staff and receives a copyable onboarding URL (no Clerk email sent).
- [ ] New users complete sign-up, set PIN, and land in the portal via the branded flow.
- [ ] Existing users complete sign-in, set PIN, and land in the portal via the same branded flow.
- [ ] Tokens are single-use, expire, and are stored hashed.
- [ ] `hashPin` exists in exactly one module and is consumed by all callers.
- [ ] Consume endpoint rejects mismatched session/email and unconsumed-but-expired tokens.
