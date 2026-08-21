# Resolved contract

## Timeout policy

The bounded client wait is 1,500 ms. This is short enough to prevent kiosk deadlock while allowing a normal local route response to provide the optional offer.

The lookup hook owns its `AbortController` and clears its deadline when the request settles. An aborted, rejected, unavailable, or non-offer response resolves the hook as settled with `null` offer. The router then opens the already-selected booking context.

## Observability policy

Client instrumentation logs only an event name, outcome, and whole-request duration in milliseconds. Route instrumentation logs an event name, outcome, total duration, and named database-call durations in milliseconds. No dynamic request value is emitted: no customer information, course slug, date, time, IP, authorization, payment fields, or error body.
