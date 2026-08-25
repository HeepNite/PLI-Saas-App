# Implementation Tasks - two-stage manual assistance recovery

## Implementation Goal

Implement the approved resend-threshold, unprivileged-draft, staff-confirmed privileged-ticket recovery path without changing the existing administrative student-creation, attendance, payment, Clerk configuration, or authorization contracts.

## Guardrails

- No scanner requirement. The student receives a manual assistance code in the popup and gives it to host/staff.
- The second resend is a UX threshold, not proof of delivery failure.
- Client action may create only an unprivileged draft; only authenticated Owner/Admin/Front Desk confirmation may create a privileged ticket.
- Reuse `POST /api/staff/students`, `authorizeStudentOperationalRequest()`, `canOperateStudentEdits` / `studentOps`, and existing audit behavior. Teachers are excluded before disclosure.
- Do not add recovery-specific creation, payment, checkout, attendance, payment-state, OAuth, Clerk-setting, or permission variants.
- Keep draft/ticket codes and payloads out of URLs, browser storage, analytics, logs, telemetry, error reporting, and audit payloads.

## Ordered Tasks

### 1. Confirm integration seams

- [ ] Trace resend/cooldown state and bind the second-resend UX threshold to the active supervised enrollment without inferring delivery failure.
- [ ] Verify distinct existing-user, verification-failure, and generic-error outcomes.
- [ ] Verify staff authorization, existing admin route, Clerk verified-phone operation, transaction ordering, audit writer, lifecycle hooks, and existing attendance/payment inputs.
- [ ] Record concrete file paths and confirmed side-effect ordering before dependent tasks.

**Complete when:** the team can implement the two stages without inventing a second creation workflow or delivery-failure classifier.

### 2. Add bounded draft and ticket persistence

- [ ] Add minimal short-lived recovery-draft storage with a manual-code verifier, captured identity fields, enrollment binding, threshold/action reference, state, and lifecycle metadata.
- [ ] Add minimal privileged-ticket storage with draft reference, staff-confirmation audit reference, credential verifier, expiry, state, and lifecycle metadata.
- [ ] Enforce one valid draft per active enrollment/action and atomic one-time `issued -> consumed` privileged-ticket transition.
- [ ] Remove sensitive payload on consumption, expiry, invalidation, and cleanup.

**Complete when:** a draft has no creation or verification privilege and a privileged ticket is bounded, one-time, and server-enforced.

### 3. Implement threshold-gated draft issuance and popup

- [ ] Preserve existing resend/cooldown behavior and expose `Code did not arrive?` only after the second resend.
- [ ] Require explicit student action to create the unprivileged draft.
- [ ] Generate a collision-safe opaque manual assistance code, retain only its verifier and non-secret namespace marker, exhaust a namespace without repeated candidates before rollover, and display it only in a non-URL popup instructing the student to give it to host/staff.
- [ ] Reject generic errors, client state, prepared Clerk users, and unverified Clerk users as privileged-ticket issuance evidence.

**Complete when:** the second resend enables assistance UX but the client can create only an unprivileged draft.

### 4. Implement authorized staff review and privileged-ticket issuance

- [ ] Authenticate and apply `studentOps` before manual-code lookup or draft disclosure; reject Teachers and unauthenticated callers uniformly.
- [ ] Require staff code entry, verify draft state/expiry/enrollment binding, and reveal captured identity fields only after authorization.
- [ ] Require explicit no-SMS and phone-validation confirmations.
- [ ] Create the privileged ticket only after those confirmations and audit the decision without retaining credentials or duplicate payload.
- [ ] Present a visible recovery control before ordinary contact fields that opens a dedicated dialog; keep the ordinary form unchanged through lookup and populate it only after ticket issuance.

**Complete when:** a code alone cannot create or verify an account, while authorized confirmed staff can create exactly one valid privileged ticket.

### 5. Consume the privileged ticket through the existing admin route

- [ ] Extend `POST /api/staff/students` with the privileged ticket as an authorization input only.
- [ ] Derive phone/name/email exclusively from the ticket/draft; ignore replacements from the consumer.
- [ ] Atomically consume/scrub the reserved ticket, execute the local user/attendance/payment writes, and write audit facts in the existing transaction; roll back all of them together on failure.
- [ ] Reserve before Clerk work, make Clerk identity/verified-phone work idempotently reconcilable on retry, and release the reservation after any external or local failure.
- [ ] Preserve all existing attendance date/session and payment behavior exactly.

**Complete when:** valid staff-confirmed recovery completes the unchanged admin workflow and invalid/replayed tickets confer no privilege.

### 6. Wire lifecycle cleanup

- [ ] Invalidate drafts and tickets on completion, cancellation, timeout, terminal reset, staff logout, and account switch when supervision ends.
- [ ] Enforce expiry on every server operation and use cleanup as a backstop.
- [ ] Ensure sensitive payload removal retains only minimal non-sensitive lifecycle data when needed.

**Complete when:** missed client cleanup cannot preserve recovery capability.

### 7. Add focused tests

- [ ] Test outcome separation and that second resend is a UX gate, not delivery-failure proof.
- [ ] Test explicit-action draft creation, code opacity, popup instruction, TTL, and absence of account privilege.
- [ ] Test authorization-before-disclosure, Owner/Admin/Front Desk access, Teacher exclusion, uniform failures, review, and dual confirmation.
- [ ] Test the dedicated staff dialog trigger, display-only lookup, and post-confirmation form population.
- [ ] Test one-time privileged ticket issuance/consumption, concurrent reservation, expiry, lifecycle invalidation, audit, and non-leakage.
- [ ] Force `POST /api/staff/students` local failure after reservation and prove the same authorization retries successfully without duplicate creation.
- [ ] Regression-test unchanged admin attendance/payment behavior and verified-phone treatment restricted to valid consumption.

**Complete when:** focused coverage proves both the unprivileged-draft boundary and privileged-ticket boundary.

### 8. Validate the approved contract

- [ ] Manually validate the student popup and staff-PC workflow without a scanner.
- [ ] Confirm the code alone cannot create or verify an account and that a Teacher cannot disclose or consume recovery data.
- [ ] Inspect observability surfaces for prohibited credentials/payloads.
- [ ] Review every requirement, especially lifecycle cleanup and unchanged attendance/payment behavior.

**Complete when:** evidence proves the approved two-stage recovery contract end to end.
