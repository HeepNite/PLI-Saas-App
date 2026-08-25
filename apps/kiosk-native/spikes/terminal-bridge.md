# Terminal Bridge Feasibility Spike

## Goal

Decide whether PR4 may use Kotlin Multiplatform for Stripe Terminal Tap to Pay, or must fall back to separate native iOS and Android apps.

## Feasibility Criteria

- KMP MUST prove a working bridge for the official Stripe Terminal SDK on both iOS and Android.
- The bridge MUST support Tap to Pay on the real device targets, not simulator-only flows.
- Connection token, reader discovery, collect, confirm, cancel, and retry flows MUST be callable from shared code without unsafe platform divergence.
- Error handling MUST preserve Stripe-native failure categories so the backend can decide retry vs rollback.
- Build and release steps MUST stay supportable by the current team without custom forked SDK maintenance.

## Evidence Required Before PR4

1. A real-device demo on iOS.
2. A real-device demo on Android.
3. Notes for unsupported APIs or platform-specific code that cannot stay behind a thin bridge.
4. Operational risks for SDK upgrades, certification, and debugging.

## Fallback Policy

If any feasibility criterion remains unproven, or the bridge requires high-risk native divergence, PR4 MUST use separate native iOS and native Android apps with the official Stripe Terminal SDKs.

- React Native MAY be acknowledged as Stripe-supported, but it is not the fallback for this change.
- Flutter MUST NOT be treated as first-class for this capability without verified support.
- The backend contract for connection tokens and payment orchestration MUST remain identical regardless of the kiosk client platform.

## Current Decision

KMP remains a spike only. Until the evidence above exists, the safe implementation policy is separate native iOS and Android apps.
