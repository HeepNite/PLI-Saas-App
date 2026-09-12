# Proposal: Native Kiosk M2 Self-Service

## Intent

Deliver only the M2 delta for equal-priority Android/iPad kiosks, with one of PLI's two readers per tablet. The provider-neutral KMP/Nest foundation exists in a complete local, unmerged 32-commit native-tap/native-kiosk chain. Its current source tip is `fade8d5` (delivery evidence, not a product requirement); integrating that foundation is a prerequisite, not this change's behavior.

## Scope

### In Scope
- Android/iPad hosts; official M2 adapters (BLE both, optional Android USB); serial/tablet/Stripe Location assignment; one-active-collection ownership; resilient lifecycle/evidence.
- Online-only flow with connectivity preflight/redundancy, pinned class/amount, same-PaymentIntent `Unknown` recovery, two decline retries, pre-presentation cancel, 90-second idle timeout, optional receipt-only email, and authoritative Done/8-second reset.
- Audited owner/admin/manager bind/replace/unbind; ordinary staff and public users remain excluded.
- Existing full web-kiosk handoff, including current QR behavior, only when M2 is unavailable before collection.
- W17 physical validation against only the HTTPS Vercel Preview deployment associated with `codex/develop`, with endpoint, deployment, and branch-association evidence recorded before device use.

### Out of Scope
- Rewriting existing foundation authority, idempotency, reconciliation, finalization/refund, or web/QR contracts.
- True offline acceptance, PLI iPhone Tap to Pay, Kronos implementation/dependency, duplicate QR, student identity creation, or web-kiosk removal.
- Production and custom-domain validation, including `https://pli.palladiumlatin.art`.

## Capabilities

### New Capabilities
- `native-kiosk-m2-self-service`: M2 installation, collection ownership, customer lifecycle, recovery presentation, receipt input, fallback gating, and physical validation.

### Modified Capabilities
- None; existing foundation contracts are prerequisite references.

## Approach

First integrate the complete 32-commit native-tap/native-kiosk foundation chain through its current source tip. Preserve Nest authority, reader auth/tokens/jobs/recovery/reconciliation, anonymous finalizer/refunds, and provider-neutral KMP contracts/`FastTapCoordinator`. Later specs MUST reference—not rewrite—those contracts. Adapters own M2 SDK concerns. Schema changes are limited to additive M2 fields/constraints only if design proves necessity. The source commit identifier records delivery provenance only and MUST NOT define product behavior or acceptance criteria.

## Affected Areas

| Area | Impact | Boundary |
|---|---|---|
| `apps/backend/src/terminal/` | Integrate/preserve | Existing authority, jobs, recovery, reconciliation; targeted M2 extensions only |
| `lib/native-tap/` | Preserve | Finalization/refund invariants remain unchanged |
| `prisma/migrations/20260812151500_add_native_fast_tap/` | Integrate/preserve | Existing `NativeReader`/`NativePaymentJob` foundation |
| `native-kiosk/shared/.../payment/` | Integrate/extend | Preserve contracts/coordinator; add only M2-neutral states |
| `native-kiosk/androidApp/`, `iosApp/`, M2 adapters | New | Equal-priority hosts and SDK integration |
| `prisma/schema.prisma`, future migrations | Conditional | M2-only additive fields/constraints if proven |
| Web kiosk/QR | Preserve | Independent deployment and pre-collection fallback |

## Dependencies/Rollout

Integrate the complete local 32-commit native-tap/native-kiosk foundation chain before M2 work; record its current source tip in delivery metadata rather than behavioral requirements. Purchase two M2s; validate Reader A sequentially on both tablets before permanent assignments/parallel operation. W17 MUST use only the HTTPS Vercel Preview deployment associated with `codex/develop`; Production and `https://pli.palladiumlatin.art` MUST NOT be used. Validate Galaxy Tab S5e (`SM-T727V`, Android 11) and exact iPad/iPadOS. Gate native starts while reconciliation and web/QR remain active.

## Delivery Chain

- Approved issue: #427.
- Use the feature-branch-chain strategy with a 400 changed-line review budget per child PR.
- The tracker branch `feat/native-kiosk-m2-tracker` targets `codex/develop`.
- The first child PR targets the tracker; every later child PR targets its immediate predecessor.
- Child PRs MUST NOT partially integrate the feature into production; only the completed tracker ultimately integrates into `codex/develop`.
- Run final Preview validation only after the complete child chain has accumulated on the tracker.

## Risks

- Foundation divergence may cause duplication; integration and contract-reference review are blocking.
- Device/SDK, update, battery, BLE, and kiosk-lifecycle behavior require physical evidence.

## Rollback Plan

Disable M2 starts, remove only M2 assignments/extensions after jobs are terminal, and keep foundation models, finalizer, refunds, reconciliation, and web/QR intact.

## Success Criteria

- [ ] Both tablets pass M2 behavior against the HTTPS `codex/develop` Vercel Preview, with exact endpoint/deployment/branch evidence and no duplicated foundation contracts.
- [ ] W17 evidence confirms Production and `https://pli.palladiumlatin.art` were not used.
- [ ] Rollback removes only M2 delta; foundation and web/QR remain operational.
