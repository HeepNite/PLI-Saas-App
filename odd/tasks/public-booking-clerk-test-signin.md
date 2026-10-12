# Public Booking Clerk Test-Phone Sign-In

## Goal

Restore account access for an existing Clerk test phone in the public Heritage booking flow without creating more identities, weakening exact-phone ownership, or changing kiosk/non-public behavior.

## Contract

- Active spec: `docs/specs/heritage-pin-campaign/requirements.md`, especially requirements 20, 24, 26, and 28.
- Authorized remote reproduction is limited to the already-created `+1 (555) 555-0140` identity on `dev.palladiumlatin.art`.
- Do not create additional identities, submit checkout, or make payments.
- Base: `origin/codex/develop` at `db0b6f576e5612fa1c28279518ef4a516021353f`.
- Branch: `fix/public-booking-clerk-test-signin`.

## Tasks

- [x] Capture the exact Clerk browser error for the existing `0140` account and record the failing contract.
  - Evidence: Clerk `POST /v1/client/sign_ins` returned HTTP 422 `form_identifier_not_found` (`Couldn't find your account.`); one click retried five identical requests and never reached code entry.
- [x] Add focused regression coverage and implement the account-access correction.
  - Exact Clerk phone and email matches are classified independently; email-only accounts use Clerk `email_code`, phone/both retain `phone_code`, and deterministic `form_identifier_not_found` stops without retry.
  - RED was not observable because the clean worktree initially lacked resolvable dependencies; this lifecycle limitation is retained explicitly.
- [x] Run focused tests, typecheck, lint/diff checks, and a bounded authorized dev reproduction.
  - Focused Vitest: 35/35 passed. Scoped ESLint: 0 errors, 6 pre-existing warnings. `git diff --check`: passed.
  - Typecheck ran and failed on unrelated repository-wide Prisma/qrcode diagnostics; no candidate file produced a diagnostic.
  - Live baseline reproduction captured the Clerk failure. Corrected live behavior remains pending deployment and is not claimed.
- [x] Prepare reviewable work units under the 400-line review budget.
  - Slice 1: `524eb31be928e5093116feb37f0ec3bc3572cac9` — `fix(auth): support email code account access` (327 changed lines).
  - Slice 2: `21713fa7cac276dac061a6d788b3aa21c447ee55` — `fix(booking): route existing email access correctly` (90 changed lines), dependent on Slice 1.
  - Native review `review-17aa3dc94a7524a3` approved and acknowledged Slice 1 with informational findings only.
  - Native review `review-88c774ed26919a16` approved and acknowledged Slice 2 with informational findings only after one transient reviewer WebSocket failure and exact bound retry.
  - No push, PR, deploy, merge, checkout, or payment was performed.

## Delivery Chain

```text
origin/codex/develop
└─ Slice 1: 524eb31b — email-code authentication capability
   └─ Slice 2: 21713fa7 — public-booking identifier routing (current)
```

## Delivery Tasks

- [x] Create a conforming bug issue, then obtain explicit maintainer approval for that exact issue.
  - Issue #628: `https://github.com/HeepNite/PLI-Saas-App/issues/628` (`status:approved`, read-back confirmed).
- [x] Push the two stacked behavior branches and open issue-linked PRs with exactly one `type:bug` label each.
  - PR #629: `https://github.com/HeepNite/PLI-Saas-App/pull/629` (`codex/develop` ← `fix/public-booking-clerk-email-access`).
  - PR #630: `https://github.com/HeepNite/PLI-Saas-App/pull/630` (`fix/public-booking-clerk-email-access` ← `fix/public-booking-clerk-test-signin`).
  - Both PR bodies and `type:bug` labels were read back and confirmed.
- [ ] Merge sequentially after required checks, verify the Vercel dev deployment, and run the authorized `0140` smoke test without checkout or payment.

## Evidence

- User screenshot: existing-phone popup reaches Phone Access but reports `We couldn't send the code to your phone.`
- Vercel deployment: `dpl_5ib7VmGKZZTvwvw4LgMC5UQ9yJ8S`; browser-to-Clerk errors are not present in Vercel logs.
- Clerk test-phone contract: `+1 (XXX) 555-0100…0199`, fixed verification code `424242`, no real SMS.
