# Design

## Localized changes

1. Add a `1,500 ms` deadline to `requestTerminalConsecutiveOfferApi`, forwarding an abort signal and emitting safe client timing in `finally`.
2. Let `useConsecutiveOfferState` consume the bounded adapter result; its existing settle transition releases the router gate.
3. Keep `useEntryModeRouter` responsible for preserving `newBookingOverride` and opening it once the bounded lookup settles.
4. Add small route helpers to measure each existing Prisma read and emit an aggregate safe timing event before every route return.

## Failure behavior

The offer is an enhancement, never a prerequisite. Any lookup failure results in a null offer and opens the selected class booking flow. The route remains fail-soft and returns `null` on database failure.

## Non-goals

- No schema, endpoint, authorization, rate-limit, payment, or UI redesign.
- No retry loop or background request after timeout.
- No external telemetry service or dependency.
