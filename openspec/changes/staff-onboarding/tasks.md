# Tasks: Staff Onboarding Flow

## Review Workload Forecast
- Estimated changed lines: ~350-450
- Files touched: ~8
- Chained PRs recommended: No (under 400 line budget if refactor is tight)
- 400-line budget risk: Medium
- Decision needed before apply: Yes (close to budget)

## Task List

### Task 1: Extract shared PIN utilities
**Files**: `lib/security/staff-pin.ts` (new), `app/api/staff/users/route.ts` (modify)
**Description**:
- Create `lib/security/staff-pin.ts` with `hashPin(pin: string): string` and `isValidPinFormat(pin: string): boolean`
- Update `app/api/staff/users/route.ts` to import from shared module
- Find any other files that duplicate hashPin and update them
**Acceptance**: hashPin exists in exactly one module, all callers import from it, no behavior change
**Estimated lines**: ~30 new, ~20 removed

### Task 2: Prisma StaffOnboardingToken model + migration
**Files**: `prisma/schema.prisma` (modify), migration file (new)
**Description**:
- Add StaffOnboardingToken model per spec data model
- Fields: id, tokenHash (unique), email, role, category, subCategory, firstName, lastName, clerkUserId, issuedByClerkUserId, consumedAt, consumedByClerkUserId, expiresAt, createdAt
- Indexes on: tokenHash (unique), email, expiresAt
- Run `npx prisma migrate dev --name add-staff-onboarding-token`
**Acceptance**: Migration runs clean, model available via Prisma client
**Estimated lines**: ~25

### Task 3: Modify POST /api/staff/users — token generation
**Files**: `app/api/staff/users/route.ts` (modify)
**Description**:
- Import `randomBytes`, `createHash` (already imported)
- Import `prisma` (already imported)
- New user branch: replace `client.invitations.createInvitation()` with:
  1. Generate rawToken = randomBytes(32).toString("base64url")
  2. Hash tokenHash = createHash("sha256").update(rawToken).digest("hex")
  3. Invalidate previous unconsumed tokens for same email (update where email + consumedAt is null → set consumedAt = now, consumedByClerkUserId = "superseded")
  4. Create StaffOnboardingToken record
  5. Return { mode: "onboarding_link", onboardingUrl: `${origin}/staff/welcome?token=${rawToken}` }
- Existing user branch: keep metadata update, additionally create token + return URL
- Both branches return the onboarding URL
**Acceptance**: No Clerk invitation sent. Both branches return onboardingUrl. Old tokens invalidated.
**Estimated lines**: ~60 changed

### Task 4: Create consume endpoint
**Files**: `app/api/staff/onboarding/consume/route.ts` (new)
**Description**:
- POST handler
- Read { token, pin } from body
- Hash token → lookup StaffOnboardingToken by tokenHash
- Validate: exists, not consumed, not expired
- Validate: Clerk auth session exists (auth() from @clerk/nextjs/server)
- Validate: session user email matches token email (case-insensitive)
- Validate: isValidPinFormat(pin)
- For new users: apply role + category to Clerk publicMetadata
- Hash PIN → store in Clerk privateMetadata
- syncStaffAccountFromClerkUser
- createStaffRoleAudit(action: "onboarding_completed")
- Mark token consumed (consumedAt, consumedByClerkUserId)
- Rate limit: 5 per IP per 15 min
- Return { redirect: "/staff/resolve" }
**Acceptance**: All spec scenarios S3, S4, S5, S6, S7 pass
**Estimated lines**: ~120

### Task 5: Create welcome page (server + client)
**Files**: `app/staff/welcome/page.tsx` (new), `app/staff/welcome/WelcomeClient.tsx` (new)
**Description**:
- Server component (`page.tsx`):
  - Read ?token query param
  - Hash → lookup StaffOnboardingToken
  - Validate not consumed, not expired
  - If invalid: render error state
  - If valid: pass token info to WelcomeClient
- Client component (`WelcomeClient.tsx`):
  - State machine: "auth" → "pin" → "complete"
  - Auth step: render EmbeddedSignUp (clerkUserId null) or EmbeddedSignIn (clerkUserId set)
  - On auth success: transition to PIN step
  - PIN step: two 4-digit inputs, confirm match, submit to consume endpoint
  - On consume success: redirect to /staff/resolve
  - Handle: already signed in as wrong user, expired during flow
**Acceptance**: Branded UI, scenarios S3-S8 pass
**Estimated lines**: ~180

### Task 6: Admin UI — show onboarding URL
**Files**: `components/front/staff/StaffUsersAdminClient.tsx` (modify)
**Description**:
- After successful create/promote, if response includes `onboardingUrl`:
  - Show success banner with the URL
  - Add copy-to-clipboard button
  - Message: "Share this link with {name} to complete onboarding"
- Replace existing "Invitation sent" / "Existing user promoted" messages
**Acceptance**: Admin sees copyable URL after promotion
**Estimated lines**: ~30 changed

## Dependency Order
```
Task 1 (PIN util) → independent, do first
Task 2 (Prisma model) → independent, do first
Task 3 (route change) → depends on Task 1 + Task 2
Task 4 (consume endpoint) → depends on Task 1 + Task 2
Task 5 (welcome page) → depends on Task 4
Task 6 (admin UI) → depends on Task 3
```

## Suggested PR Strategy
All tasks fit in a single PR (~350-450 lines). If review budget is tight:
- PR1: Tasks 1+2 (infra: shared util + Prisma model) ~55 lines
- PR2: Tasks 3+4+6 (backend: route changes + consume + admin UI) ~210 lines
- PR3: Task 5 (frontend: welcome page) ~180 lines
