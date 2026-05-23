# Spec: Staff Onboarding Flow

## Overview
This spec defines a token-gated, PLI-branded staff onboarding flow that replaces Clerk's invitation email. A single welcome link (`/staff/welcome?token=xxx`) drives both new-user sign-up and existing-user sign-in, captures a self-selected 4-digit PIN, applies role and category to Clerk metadata, mirrors to the `StaffAccount` Prisma model, and writes an audit entry. The raw token never persists; only a SHA-256 hash is stored. Tokens are single-use, expire in 72 hours, and are bound to the target email at consume time to prevent hijack.

## Requirements

### REQ-1: Token Generation
- `POST /api/staff/users` creates a `StaffOnboardingToken` for every promotion/invite (both new and existing Clerk users).
- Raw token: 32 bytes from `crypto.randomBytes`; stored only as SHA-256 hash (`tokenHash`).
- `expiresAt` = `createdAt + 72h`.
- Any unconsumed token for the same `email` is invalidated (set `consumedAt = now` with sentinel `consumedByClerkUserId = "superseded"` or equivalent) before the new one is written.
- Response body includes `onboardingUrl` containing the raw token as a query param: `${origin}/staff/welcome?token=<raw>`.
- For existing Clerk users, `clerkUserId` is stored on the token; Clerk public metadata is still flipped immediately (current behavior preserved).
- For new users, `clerkUserId` is `null`; `client.invitations.createInvitation` is NOT called.
- `issuedByClerkUserId` is the acting admin's Clerk user id.

### REQ-2: Welcome Page
- `GET /staff/welcome?token=xxx` is a public, server-rendered route (no auth required to view).
- Server validates the token: lookup by SHA-256 hash, reject if missing, `consumedAt != null`, or `expiresAt < now`.
- Invalid, expired, or consumed tokens render a clear error state; no exceptions surface.
- Valid token renders branded "Welcome to the team" with `firstName` (when present) and human-readable role/category labels.
- If `token.clerkUserId == null` → mount `EmbeddedSignUp`.
- If `token.clerkUserId != null` → mount `EmbeddedSignIn`.
- If a Clerk session is already active with a `userId` that does not match `token.clerkUserId` (when set) or whose primary email differs from `token.email`, show a "sign out first" message and block the flow.

### REQ-3: PIN Selection
- After auth completes client-side (`setActive` resolved), the welcome flow advances to a PIN step.
- PIN must be 4 digits; entered twice for confirmation.
- Mismatch shows inline error "PINs do not match" and blocks submission.
- On submit, the client posts `{ token: <raw>, pin }` to the consume endpoint.

### REQ-4: Token Consumption
- `POST /api/staff/onboarding/consume` accepts `{ token: string, pin: string }`.
- Validates: token exists by hash, `consumedAt == null`, `expiresAt > now`, `isValidPinFormat(pin)`.
- Requires an authenticated Clerk session (`auth()` userId present); else 401.
- Loads the Clerk user; primary email (lowercased) must equal `token.email`. Mismatch → 403; token NOT consumed.
- Applies role + category + subCategory to `publicMetadata` via `applyStaffRoleToMetadata` / `applyStaffCategoryToMetadata` / `applyStaffSubCategoryToMetadata`.
- Hashes the PIN via the shared util and stores `staffPinHash` + `staffPinUpdatedAt` in `privateMetadata`.
- Calls `syncStaffAccountFromClerkUser(updated, { source: "staff_onboarding_consume" })`.
- Writes `StaffRoleAudit` with `action: "onboarding_completed"`, actor = consuming user, metadata `{ tokenId, email }`.
- Marks the token consumed: `consumedAt = now`, `consumedByClerkUserId = session.userId`.
- Returns `{ redirectTo: "/staff/resolve" }`.
- Rate limit: 5 attempts per IP per 15 minutes via existing `consumeRateLimit` helper.

### REQ-5: hashPin Deduplication
- Extract `hashPin` and `isValidPinFormat` from `app/api/staff/users/route.ts` into `lib/security/staff-pin.ts`.
- Update all callers to import from the shared module.
- No behavior change; algorithm and output unchanged.

### REQ-6: Admin UI Update
- After a successful `POST /api/staff/users` response, the admin staff portal renders a success banner containing the `onboardingUrl` and a copy-to-clipboard button.
- Applies to both `mode: "promoted_existing"` and `mode: "invited"` responses.
- The URL is shown as inspectable text plus an explicit copy control (not buried in a toast).

## Scenarios

### S1: Admin invites new user (no Clerk account)
Given admin enters email `newperson@example.com` with role `staff` and category `front_desk`
When admin submits the form
Then a `StaffOnboardingToken` is created with `clerkUserId = null`
And the admin sees a copyable onboarding URL
And no Clerk invitation email is sent

### S2: Admin promotes existing user (has Clerk account)
Given admin enters email `existing@example.com` already in Clerk
When admin submits the form
Then a `StaffOnboardingToken` is created with `clerkUserId` set
And Clerk `publicMetadata` is updated with role + category immediately
And the admin sees a copyable onboarding URL

### S3: New user completes onboarding
Given a valid token for a new user
When user opens the welcome link
Then they see "Welcome to the team" with their role
And they complete sign-up via `EmbeddedSignUp`
And they set a 4-digit PIN entered twice
And the token is consumed, role applied, PIN stored
And they are redirected to `/staff/resolve`

### S4: Existing user completes onboarding
Given a valid token for an existing user
When user opens the welcome link
Then they see "Welcome to the team" with their role
And they sign in via `EmbeddedSignIn`
And they set a 4-digit PIN
And the token is consumed, PIN stored
And they are redirected to `/staff/resolve`

### S5: Expired token
Given a token older than 72 hours
When user opens the welcome link
Then they see "This invitation has expired. Contact your administrator."

### S6: Already consumed token
Given a token with `consumedAt != null`
When user opens the welcome link
Then they see "This invitation has already been used."

### S7: Email mismatch on consume
Given a valid token for `alice@example.com`
When a user authenticated as `bob@example.com` posts to `/api/staff/onboarding/consume`
Then the endpoint returns 403
And the token is NOT consumed

### S8: PIN confirmation mismatch
Given user is on the PIN selection step
When they enter `1234` and confirm with `5678`
Then they see "PINs do not match"
And the form is not submitted

### S9: Duplicate promotion (re-invite)
Given admin promotes `alice@example.com` who already has an unconsumed token
When the new promotion is submitted
Then the old token is invalidated
And a new token is created and returned

## Data Model

### StaffOnboardingToken
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| tokenHash | String | SHA-256 of raw token, `@unique` |
| email | String | Lowercased target email, indexed |
| role | String | Role to grant (`owner` \| `admin` \| `staff`) |
| category | String? | StaffCategory to grant |
| subCategory | String? | StaffSubCategory to grant |
| firstName | String? | For welcome display |
| lastName | String? | For welcome display |
| clerkUserId | String? | `null` = new user |
| issuedByClerkUserId | String | Admin who created it |
| consumedAt | DateTime? | `null` = unconsumed |
| consumedByClerkUserId | String? | Who consumed it (or sentinel on supersede) |
| expiresAt | DateTime | `createdAt + 72h` |
| createdAt | DateTime | `@default(now())` |

Indexes: `@@index([email])`, `@@index([expiresAt])`.
