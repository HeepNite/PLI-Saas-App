# kiosk-tap-to-pay Specification

## Purpose

Define the first native kiosk payment flow for class-scoped drop-in sales using Stripe Terminal Tap to Pay.

## Requirements

### Requirement: Anonymous Kiosk Drop-In Payment

The system MUST allow a staffed kiosk or tablet that already knows the current class and time to sell an anonymous drop-in through native Tap to Pay.

Successful payment MUST record a drop-in purchase and attendance/check-in outcome for that class context without requiring customer account identity.

#### Scenario: Anonymous customer completes Tap to Pay

- GIVEN the kiosk is already scoped to the active class and time
- WHEN the customer selects Drop-in and completes native Tap to Pay successfully
- THEN the system records an anonymous drop-in purchase for that class context
- AND the check-in result is available to the kiosk flow

#### Scenario: Payment fails or is canceled

- GIVEN the kiosk is ready to accept an anonymous drop-in payment
- WHEN Tap to Pay fails, is canceled, or is not confirmed
- THEN no successful check-in is recorded
- AND the kiosk can present a retry or operator recovery path

### Requirement: Payment NFC Is Not Identity

The system MUST treat Tap to Pay/NFC as payment acceptance only.

The first slice MUST NOT use browser-based Tap to Pay, NFC identity, or payment-tap identity inference.

#### Scenario: Anonymous flow stays identity-free

- GIVEN an anonymous customer pays at the kiosk
- WHEN the payment succeeds
- THEN the system completes the anonymous sale without linking identity from the phone tap
- AND no package or account lookup is inferred from NFC

#### Scenario: Unsupported browser reader path

- GIVEN a browser or PWA kiosk attempts to act as the Tap to Pay reader
- WHEN payment acceptance is evaluated
- THEN the flow is rejected as unsupported for the first slice
- AND a native reader-capable kiosk app is required

### Requirement: Native Platform Feasibility Gate

The kiosk implementation MUST be backed by a platform with verified Stripe Terminal Tap to Pay support for the target device path.

Kotlin Multiplatform MAY proceed only after feasibility is validated. If that feasibility is not proven quickly and reliably for both iOS and Android, the implementation MUST fall back to separate native iOS and native Android apps using the official Stripe Terminal SDKs. React Native MAY be acknowledged as a Stripe-supported alternative but MUST NOT be treated as the preferred fallback for this change. Flutter MUST NOT be assumed first-class without verified support for this capability.

#### Scenario: Preferred platform is feasible

- GIVEN the team evaluates the preferred native kiosk platform
- WHEN Stripe Terminal Tap to Pay support is verified for the required target devices
- THEN the kiosk implementation may proceed on that platform

#### Scenario: Preferred platform is not feasible

- GIVEN the preferred platform lacks verified support or requires unacceptable bridging risk
- WHEN the platform decision is finalized
- THEN the implementation falls back to separate native iOS and native Android apps using the official Stripe Terminal SDKs
- AND the unsupported platform is not used for the first slice
