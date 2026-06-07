# Design: Staff Onboarding Flow

## Architecture

### Component Diagram

```
┌──────────────────────────┐
│ Admin (Staff Portal)     │
│ StaffUsersAdminClient    │
└────────────┬─────────────┘
             │ submits email + role + category
             ▼
┌──────────────────────────────────────────┐
│ POST /api/staff/users                    │
│  - Lookup Clerk by email                 │
│  - Generate raw token (32 bytes)         │
│  - Persist StaffOnboardingToken          │
│    (tokenHash, email, role, etc.)        │
│  - If existing Clerk user:               │
│      apply role metadata immediately     │
│  - Return { onboardingUrl }              │
└────────────┬─────────────────────────────┘
             │ admin copies & shares link
             ▼
┌──────────────────────────────────────────┐
│ GET /staff/welcome?token=<raw>           │
│  (server component)                       │
│  - SHA-256(raw) → tokenHash              │
│  - Lookup StaffOnboardingToken           │
│  - Validate: exists, not consumed,       │
│    not expired                           │
│  - Render WelcomeClient with token info  │
└────────────┬─────────────────────────────┘
             │ token-derived props
             ▼
┌──────────────────────────────────────────┐
│ WelcomeClient (client component)         │
│  Step 1: Branded welcome                 │
│  Step 2: EmbeddedSignUp (clerkUserId     │
│          == null) OR EmbeddedSignIn      │
│  Step 3: PIN selection (4 digits x 2)    │
│  Step 4: POST /api/staff/onboarding/     │
│          consume                         │
└────────────┬─────────────────────────────┘
             ▼
┌──────────────────────────────────────────┐
│ POST /api/staff/onboarding/consume       │
│  - Validate raw token → hash → lookup    │
│  - Verify Clerk session (auth())         │
│  - Match session email == token.email    │
│  - Apply role + category metadata        │
│  - Hash PIN → store privateMetadata      │
│  - syncStaffAccountFromClerkUser         │
│  - createStaffRoleAudit                  │
│  - Mark token consumed                   │
│  - Return { redirectTo: "/staff/resolve" }│
└────────────┬─────────────────────────────┘
             ▼
        /staff/resolve → portal
```

### New Files
| File | Type | Purpose |
|------|------|---------|
| `prisma/schema.prisma` (addition) | Model | `StaffOnboardingToken` model + migration |
| `lib/security/staff-pin.ts` | Shared util | `hashPin`, `isValidPinFormat` (single source) |
| `app/staff/welcome/page.tsx` | Server page | Token validation + branded welcome wrapper |
| `app/staff/welcome/WelcomeClient.tsx` | Client component | Auth + PIN selection flow |
| `app/api/staff/onboarding/consume/route.ts` | API endpoint | Token consumption, role apply, PIN hash |

### Modified Files
| File | Change |
|------|--------|
| `app/api/staff/users/route.ts` | Replace `client.invitations.createInvitation` and inline PIN apply path with token generation; import `hashPin`/`isValidPinFormat` from new shared util |
| `components/front/staff/StaffUsersAdminClient.tsx` | Render `onboardingUrl` from response + copy-to-clipboard button (both `promoted_existing` and `invited` modes) |

## Data Flow

### Token Generation (Admin action — `POST /api/staff/users`)
1. Admin posts `{ email, role, category, subCategory, firstName?, lastName? }`.
2. Server validates email, role, category (existing logic preserved).
3. Server looks up Clerk user list by email.
4. Generate raw token: `randomBytes(32).toString("base64url")` (256-bit entropy, URL-safe).
5. Compute `tokenHash = sha256(rawToken)`.
6. Inside a Prisma transaction:
   - Invalidate any unconsumed token for the same `email`: set `consumedAt = now`, `consumedByClerkUserId = "superseded"`.
   - Insert `StaffOnboardingToken { tokenHash, email, role, category, subCategory, firstName, lastName, clerkUserId, issuedByClerkUserId, expiresAt: now+72h }`.
7. If existing Clerk user:
   - Apply role + category + subCategory to `publicMetadata` immediately (preserves current "promoted_existing" behavior).
   - `syncStaffAccountFromClerkUser` runs as today.
   - Write `StaffRoleAudit { action: "promote_existing" }` as today, with `metadata.tokenId` added.
   - `token.clerkUserId = current.id`.
8. If new user:
   - Skip Clerk invitation creation (no email sent).
   - `token.clerkUserId = null`.
9. Build `onboardingUrl = \`${requestUrl.origin}/staff/welcome?token=${rawToken}\``.
10. Response:
    - Existing user: `{ mode: "promoted_existing", user, onboardingUrl }`
    - New user: `{ mode: "invited", email, onboardingUrl, supportedCategories }`
    - The legacy `invitation` object is removed from the new-user response. Admin UI is the only consumer and is updated in the same change.

### Welcome Page (User action — `GET /staff/welcome?token=xxx`)
1. Server component reads `?token` from `searchParams`.
2. If absent or non-string → render generic "invalid invitation" state.
3. Compute `tokenHash = sha256(token)`; look up by `tokenHash`.
4. Validate:
   - `record` exists → else "invalid".
   - `record.consumedAt == null` → else "already used".
   - `record.expiresAt > now` → else "expired".
5. Call `auth()` to detect any active Clerk session (no redirect):
   - If signed-in session's primary email does not match `record.email` (case-insensitive) → render "sign out first" CTA and block flow.
6. Pass props to `WelcomeClient`:
   ```ts
   {
     rawToken: string,              // needed for consume POST
     mode: "signup" | "signin",     // derived from clerkUserId
     email: string,
     firstName: string | null,
     lastName: string | null,
     role: StaffRole,
     category: StaffCategory | null,
     subCategory: StaffSubCategory | null,
     roleLabel: string,             // human-readable
     categoryLabel: string | null,
   }
   ```
7. Client renders:
   - Welcome banner: "Welcome to the team, {firstName}!" (fallback: "Welcome to the team!") plus role/category badges.
   - Auth step: `EmbeddedSignUp` (when `mode === "signup"`) or `EmbeddedSignIn` (when `mode === "signin"`). Both already use phone-based auth — that stays as the auth channel.
   - On `onSuccessAction` (sign-up) or `onSessionCreated` (sign-in) the client advances to the PIN step.
   - PIN step: two `<input inputMode="numeric" maxLength={4}>` fields; submit disabled until both match the 4-digit format and equal each other.
   - On submit: `POST /api/staff/onboarding/consume` with `{ token: rawToken, pin }`.
   - On success: client-side `router.push(response.redirectTo)`.

### Token Consumption (`POST /api/staff/onboarding/consume`)
1. Parse `{ token: string, pin: string }` from JSON body. Reject malformed.
2. Apply rate limiter (existing `consumeRateLimit` helper — 5/IP/15min). 429 on exceed.
3. Compute `tokenHash = sha256(token)`; lookup `StaffOnboardingToken`.
4. Reject if missing, `consumedAt != null`, or `expiresAt < now` → 400 with safe message.
5. Validate PIN format via `isValidPinFormat(pin)` → 400 if invalid.
6. `const { userId } = await auth()` — if no userId → 401.
7. Fetch Clerk user (`client.users.getUser(userId)`); compute primary email (lowercased).
8. If `primaryEmail !== token.email` → 403, do NOT consume.
9. Apply metadata (idempotent — works for both new and existing users):
   - `applyStaffRoleToMetadata(currentPublic, token.role)`
   - `applyStaffCategoryToMetadata(..., token.category)`
   - `applyStaffSubCategoryToMetadata(..., token.subCategory)`
   - `client.users.updateUser(userId, { publicMetadata: ... })`
10. Hash PIN via shared `hashPin(pin)`; merge into `privateMetadata`:
    ```ts
    { ...currentPrivate, staffPinHash, staffPinUpdatedAt: new Date().toISOString() }
    ```
    via `client.users.updateUserMetadata`.
11. `syncStaffAccountFromClerkUser(updated, { source: "staff_onboarding_consume" })`.
12. `createStaffRoleAudit({ staffClerkUserId: userId, actorClerkUserId: userId, action: "onboarding_completed", nextRole: token.role, nextCategory: token.category, metadata: { tokenId: record.id, email: token.email } })`.
13. Mark token consumed: `consumedAt = now`, `consumedByClerkUserId = userId`.
14. Return `{ redirectTo: "/staff/resolve" }`.

### Order-of-operations Guarantees
- Metadata write happens BEFORE `consumedAt` is set. If Clerk fails, the token remains usable so the user can retry.
- Token is marked consumed in the same request as audit + StaffAccount sync — if any of those throws, return 500 and leave `consumedAt = null`.
- Re-running consume with the same token after partial failure is safe: metadata apply is idempotent; PIN re-hash overwrites with the new salt (acceptable — only the latest PIN matters).

## Security Design

### Token Security
- 256-bit entropy: `randomBytes(32).toString("base64url")` (URL-safe, 43 chars).
- Stored as SHA-256 hash; raw token only exists in the response body to the admin and in the user's URL.
- Single-use: `consumedAt` check enforced at consume.
- 72h expiry from `createdAt`.
- Rate limit on `/api/staff/onboarding/consume`: 5/IP/15min via existing `consumeRateLimit`.
- Hash collisions: SHA-256 + 256-bit input ≈ negligible. `tokenHash` carries `@unique` for defense.

### Identity Binding
- Consume requires an authenticated Clerk session AND `primaryEmail === token.email`.
- This prevents a stolen link from being used by another account: the attacker would need to control the target email at Clerk.
- For new users, the binding is established at sign-up (they verify their phone, but the only way the resulting Clerk user matches the token is if they end up with the same primary email — admin entered the email and it must match what the consume endpoint sees on the Clerk user). If a user signs up with a different email, consume returns 403; admin must reissue.

### PIN Security
- Same algorithm as today (`sha256(pin:salt:secret)` with random 16-byte salt). Moved verbatim into `lib/security/staff-pin.ts`; no behavior change.
- Stored in Clerk `privateMetadata` (server-only), never in our DB.

### Threat Mitigations
| Threat | Mitigation |
|--------|------------|
| Token brute force | 256-bit entropy + SHA-256 at rest + 72h expiry |
| Stolen link reuse | Identity binding (session email === token email) + single-use |
| Token leakage in logs | `tokenHash` lookup only; no logging of raw token; URL has `noindex` via robots meta on welcome page |
| Replay after consume | `consumedAt` check |
| Race on supersede | Prisma transaction wraps invalidate+insert |
| Session/token mismatch | Welcome page detects active session with wrong email and blocks |

## UI Design

### Welcome Page Layout
- Full-screen branded surface matching existing staff portal (`bg-[#13141d]` + red gradient — same palette as `app/staff/log-in/page.tsx`).
- Header block:
  - "Welcome to the team, {firstName}!" (or "Welcome to the team!" fallback).
  - Subtitle: "Let's get you set up to access PLI."
  - Role badge: `Your role: {roleLabel}` and `Team: {categoryLabel}` when present.
- Body switches between steps:
  - **Step `auth`** — embedded auth component (`EmbeddedSignUp` or `EmbeddedSignIn`), rendered with `bare={true}` so it nests cleanly inside the welcome card.
  - **Step `pin`** — two PIN fields with `inputMode="numeric"`, real-time match validation, "Set my PIN" submit button.
  - **Step `done`** — brief "All set! Redirecting…" before `router.push`.
- Error states (separate render path before steps):
  - `invalid` — "This invitation link isn't valid. Contact your administrator."
  - `expired` — "This invitation has expired. Ask your administrator for a new link."
  - `consumed` — "This invitation has already been used."
  - `wrong_session` — "You're signed in with a different account. Sign out to continue." plus sign-out CTA.
- Responsive: layout collapses to single column on mobile; PIN inputs use numeric keypad on iOS/Android.
- `<meta name="robots" content="noindex,nofollow">` on the welcome route.

### Admin UI Changes (`StaffUsersAdminClient.tsx`)
- After a successful POST (both `mode: "promoted_existing"` and `mode: "invited"`):
  - Replace the existing post-submit toast with a persistent success card inside the form area.
  - Card content:
    - Title: "Onboarding link ready"
    - Subtitle: "Share this link with {firstName || email} to complete their onboarding. It expires in 72 hours."
    - Inline `<code>` field showing `onboardingUrl` (read-only, selectable).
    - "Copy link" button → `navigator.clipboard.writeText(onboardingUrl)`, with "Copied!" inline confirmation for 2s.
    - "Generate another" link that clears the card.
- Validation: if `onboardingUrl` missing from response, fall back to the prior toast (defensive only).

## Constraints
- **No email automation in v1** — admin copies link manually. The Clerk invitation email path is removed for new users.
- **Phone-based auth only** — `EmbeddedSignIn` and `EmbeddedSignUp` use phone + SMS code today; that channel is reused as-is. The token's `email` is for identity binding at consume time, not the auth factor.
- **Token email must equal Clerk primary email** at consume. If they diverge (user signed up with a different email), admin must reissue.
- **Welcome page must work on mobile** — staff often onboard from a phone.
- **No database changes beyond `StaffOnboardingToken`** — `StaffAccount`, audit, payment models stay untouched.
- **`hashPin` lives in exactly one module** after this change; the inline copy in `app/api/staff/users/route.ts` is deleted, not duplicated.
- **Rollback** is a single migration drop + route revert; no data backfill required because tokens are additive and `StaffAccount` shape is unchanged.
