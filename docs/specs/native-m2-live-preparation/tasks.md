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

**Current state:** Design reconciled in `design.md`. Source analysis proved an additive one-to-one capability record unavoidable because neither the readable signed ticket, non-consuming account-preparation context, mutable Purchase metadata, nor payment status can atomically represent a random digest, caller binding, expiry, and consumption state. Capability persistence is complete in commit `01dc04c6`: 6/6 focused tests, non-incremental TypeScript, Prisma validation, and whitespace checks passed. Native review `review-ccf23970728d1b31` approved it and acknowledgement burned authority. Informational follow-ups for a real concurrency proof and expired-capability reissue belong to the preparation slice. Preparation is complete in commit `c92ac9e4`: the exact 400-line slice passed 26/26 focused tests, non-incremental TypeScript, and whitespace checks; native review `review-a5d5d64ea639928a` approved it and acknowledgement burned authority. The informational lost-preparation-response case is safe before admission (no PaymentIntent exists) but may require waiting for capability expiry before retry. Native payment is split into a signed Purchase-bound proof module and service integration so each remains within 400 changed lines. The signed proof module is complete in commit `a9001684`; 23/23 focused tests passed and native review `review-5deb051d49bc0060` approved/acknowledged it. Dynamic service integration is committed in `2e3cfe77`; native review `review-e3f806697f30e9c8` approved it and acknowledgement burned authority. Prepared-webhook fulfillment is committed in `02d2e497` (`feat(native-kiosk): fulfill exact native purchase`); no review identifier for that commit is recorded in this worktree. Real PostgreSQL concurrency remains unexecuted.

## 3. Android host

**Scope:** Add the feature-gated AndroidX WebKit bridge host with exact-origin, exact-path, main-frame admission.

**Completion criteria:**

- Redirects, new windows, foreign origins, foreign paths, and malformed messages are denied.
- No `addJavascriptInterface` fallback exists.
- Payment and provider values remain outside JavaScript.
- Focused behavior coverage proves the admission and denial boundaries.

**Current state:** Host/admission is implemented locally; main-frame navigation remains exact-target/non-redirect while subframes load without bridge admission. Provider dispatch is intentionally not connected, so the web fallback remains authoritative. Only host `onDestroy` invalidates this slice; session/reader invalidation awaits dispatch integration. No APK, device, or reader operation is authorized.

## 4. Web/native integration

**Scope:** Route the unchanged visible action through server preparation and native admission; native/server resolves the opaque reference, performs or reconciles the exact-total M2 attempt, and updates the UI only from fresh server `Paid`.

**Completion criteria:**

- Native admission prevents an automatic web re-charge.
- Unresolved attempts remain in native/server recovery.
- Fresh server `Paid` proves both payment and fulfillment of the exact immutable server-authoritative selection.
- Focused behavior coverage proves the integration and recovery boundaries.

**Current state:** The W3a web handoff correction is commit `01a32300`; its native review escalated with `native_stop_required`. The web client synchronously locks native preparation, admits one AndroidX handoff, and retains the embedded fallback only before admission. The local host is admission-only: provider dispatch remains unconnected. No provider, deployment, or LIVE payment operation is authorized.

**W3h transport unit:** The Android exact-total transport seam is committed in `d07e89b5`; native review `review-f1b7833dcadc8945` approved it and acknowledgement burned authority. It strictly imports one native-supplied `pli_terminal_session` header, digest-binds it to `ApprovedOrigin`, applies a checked 15-minute capture TTL, and keeps prepared attempt/payment/recovery payloads and strict response parsing native-only.

**W3i completion:** Exact-terminal page completion captures the CookieManager header through a narrow native seam, imports it with the W3h transport, and uses the encrypted store plus `PurchaseCoordinator.login` write/read-back path before reporting readiness. A same-origin, association, and cookie session is idempotently ready only while its persisted expiry is strictly future, preserving that expiry without another write; an expired or changed-cookie session uses guarded replacement, while any retained attempt blocks it. Any state fault, malformed/missing cookie, failed write/read-back, or import failure fails closed. No dispatcher or WebKit listener is composed, including when native collection is enabled. This is work-unit commit `2d5e9b3a`; native review `review-3592eaa9fff23f46` approved it and acknowledgement burned authority.

**W3j completion:** Durable prepared coordinator mode is commit `b6d42b8f`; native review `review-eee0e3303eb90e05` approved it and acknowledgement burned authority. It persists a ticketless marker before one prepared issue call, never retains the opaque reference, and fails closed for lost issuance or unavailable prepared APIs.

**W3k completion:** `PinnedReaderBootstrap` is work-unit commit `feef6740`; native review `review-66a2a0415c0b2fde` approved it and acknowledgement burned authority. It is a fakeable, invisible one-shot bootstrap for one unresolved `PREPARED` ticket with strictly future expiry, revalidated by an injected clock before discovery, discovery updates, and connection/continuation. It uses `ReaderPolicy` for exactly one exact M2 without probing candidates, freezes the complete first accepted immutable discovery list, and fails closed on any later full-list change (including unrelated entries), ambiguity, expiry, or invalidation including from idle; stable unrelated entries remain valid. It invokes one non-Paid continuation and composes no host, bridge, SDK, provider, or collection behavior.

**W3l committed:** Request-bound prepared bridge operations are work-unit commit `a12d472d`. They reject generated-reference collisions before insertion/launch, preserve every accepted reservation, and launch server recovery with both exact operation and prepared-purchase references. Only the bound injected authoritative completion may report `PAID`; polling stays coarse. Duplicate caching retains only SHA-256 request digests plus responses. They compose no host, provider, reader, coordinator, SDK, or collection behavior. Native review is pending because the review host returned immediately stale consent bindings before creating a lineage.

## 5. Physical and deployment gate

**Scope:** Obtain separate approval and perform any Vercel deployment, APK installation, reader provisioning or operation, and LIVE validation.

**Completion criteria:**

- Required approvals, credentials, assignments, and release controls are separately recorded.
- Deployment, installed-host, reader, and LIVE validation evidence is captured without weakening the settled contract.
- No prior slice implies satisfaction of this gate.

**Current state:** Pending; this gate is external to local implementation.
