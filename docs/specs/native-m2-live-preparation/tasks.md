# Native M2 LIVE preparation tasks

## Status and execution rule

All slices are **pending**. This is the sole implementation sequencing source for the active exact-total production contract. Each slice, including its focused behavior tests and documentation updates, is limited to 400 changed lines. Local work does not authorize Vercel mutation, deployment, APK installation, reader provisioning or operation, or a LIVE charge.

## 1. Web fallback

**Scope:** Preserve the single visible kiosk action and embedded Stripe PaymentElement fallback in `/staff/terminal` before native admission.

**Completion criteria:**

- Bridge absence or unavailability stays in `/staff/terminal` and uses the embedded PaymentElement.
- The fallback neither selects QR-hosted checkout nor redirects to `/checkin`.
- Focused behavior coverage proves those fallback boundaries.

**Current state:** Implemented and independently verified locally; pending work-unit commit and deployment authorization. The 145-line six-file slice passed 62/62 focused tests, full TypeScript, and diff checks. Its closed `paymentSurface: "embedded"` discriminator prevents a globally enabled card-present gateway from supplying an incompatible intent to PaymentElement. No deployment, provider, device, flag, or LIVE operation ran.

## 2. Prepared-purchase backend

**Scope:** Reuse checkout validation to derive the exact total for the immutable server-authoritative selected service, package, or product; create or reuse the durable pending `Purchase` and idempotency identity; issue and consume only a one-use opaque prepared-purchase reference.

**Completion criteria:**

- Client amount, product, or selection substitution fails closed.
- Duplicate use and stale opaque references fail closed.
- Unresolved recovery retains native/server ownership and never creates a replacement charge.
- The paid purchase fulfills the same immutable selection, not merely its charge.
- Whether an additive schema change is unavoidable is established before proposing one.

**Current state:** Pending; no schema or source work is authorized by this document.

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
