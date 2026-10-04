# Native M2 LIVE preparation tasks

## Status and execution rule

All slices are **pending**. This is the sole implementation sequencing source for the active exact-total production contract. Each slice, including its focused behavior tests and documentation updates, is limited to 400 changed lines. Local work does not authorize Vercel mutation, deployment, APK installation, reader provisioning or operation, or a LIVE charge.

## 1. Web fallback

**Scope:** Preserve the single visible kiosk action and embedded Stripe PaymentElement fallback in `/staff/terminal` before native admission.

**Completion criteria:**

- Bridge absence or unavailability stays in `/staff/terminal` and uses the embedded PaymentElement.
- The fallback neither selects QR-hosted checkout nor redirects to `/checkin`.
- Focused behavior coverage proves those fallback boundaries.

**Current state:** Complete in work-unit commit `d6b94ab7`. The 145-line six-file slice passed 62/62 focused tests, full TypeScript, and diff checks. Native review `review-99a4448f8859b0c8` approved it and acknowledgement burned authority. Its closed `paymentSurface: "embedded"` discriminator prevents a globally enabled card-present gateway from supplying an incompatible intent to PaymentElement. Deployment remains separately unauthorized; no provider, device, flag, or LIVE operation ran.

## 2. Prepared-purchase backend

**Scope:** Reuse checkout validation to derive the exact total for the immutable server-authoritative selected service, package, or product; create or reuse the durable pending `Purchase` and idempotency identity; issue and consume only a one-use opaque prepared-purchase reference.

**Completion criteria:**

- Client amount, product, or selection substitution fails closed.
- Duplicate use and stale opaque references fail closed.
- Unresolved recovery retains native/server ownership and never creates a replacement charge.
- The paid purchase fulfills the same immutable selection, not merely its charge.
- Whether an additive schema change is unavoidable is established before proposing one.

**Current state:** Design reconciled in `design.md`. Source analysis proved an additive one-to-one capability record unavoidable because neither the readable signed ticket, non-consuming account-preparation context, mutable Purchase metadata, nor payment status can atomically represent a random digest, caller binding, expiry, and consumption state. Capability persistence is complete in commit `01dc04c6`: 6/6 focused tests, non-incremental TypeScript, Prisma validation, and whitespace checks passed. Native review `review-ccf23970728d1b31` approved it and acknowledgement burned authority. Informational follow-ups for a real concurrency proof and expired-capability reissue belong to the preparation slice. Preparation is complete in commit `c92ac9e4`: the exact 400-line slice passed 26/26 focused tests, non-incremental TypeScript, and whitespace checks; native review `review-a5d5d64ea639928a` approved it and acknowledgement burned authority. The informational lost-preparation-response case is safe before admission (no PaymentIntent exists) but may require waiting for capability expiry before retry. Native payment is split into a signed Purchase-bound proof module and service integration so each remains within 400 changed lines. The 285-line proof module is implemented locally and independently verified: 23/23 focused tests, non-incremental TypeScript, and whitespace checks pass. Commit/review and service integration remain pending; fulfillment proof follows.

## 3. Android host

**Scope:** Add the feature-gated AndroidX WebKit bridge host with exact-origin, exact-path, main-frame admission.

**Completion criteria:**

- Redirects, new windows, foreign origins, foreign paths, and malformed messages are denied.
- No `addJavascriptInterface` fallback exists.
- Payment and provider values remain outside JavaScript.
- Focused behavior coverage proves the admission and denial boundaries.

**Current state:** Pending; no APK, device, or reader operation is authorized.

## 4. Web/native integration

**Scope:** Route the unchanged visible action through server preparation and native admission; native/server resolves the opaque reference, performs or reconciles the exact-total M2 attempt, and updates the UI only from fresh server `Paid`.

**Completion criteria:**

- Native admission prevents an automatic web re-charge.
- Unresolved attempts remain in native/server recovery.
- Fresh server `Paid` proves both payment and fulfillment of the exact immutable server-authoritative selection.
- Focused behavior coverage proves the integration and recovery boundaries.

**Current state:** Pending; no provider, deployment, or LIVE payment operation is authorized.

## 5. Physical and deployment gate

**Scope:** Obtain separate approval and perform any Vercel deployment, APK installation, reader provisioning or operation, and LIVE validation.

**Completion criteria:**

- Required approvals, credentials, assignments, and release controls are separately recorded.
- Deployment, installed-host, reader, and LIVE validation evidence is captured without weakening the settled contract.
- No prior slice implies satisfaction of this gate.

**Current state:** Pending; this gate is external to local implementation.
