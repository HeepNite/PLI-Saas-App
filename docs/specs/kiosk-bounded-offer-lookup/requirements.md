# Kiosk bounded consecutive-offer lookup requirements

## Scope

Terminal past-class users selecting **I am new** must be able to enter the booking flow even when the optional consecutive-offer lookup is slow, fails, or never resolves.

## Requirements

1. The selected previous-class context (`courseSlug`, `date`, and `time`) MUST be preserved when the new-booking flow opens.
2. A terminal consecutive-offer request MAY delay opening the booking flow for at most **1,500 ms**.
3. If the request returns a valid offer within 1,500 ms, the booking flow MUST open with that offer available.
4. On timeout, rejected request, aborted request, non-success response, or no offer, the booking flow MUST open without an offer.
5. The timeout MUST abort the client request and MUST not leave a pending booking gate.
6. The endpoint MUST retain its current response contract, rate limit, and no-offer behavior.
7. The client lookup and route database work MUST emit duration-only timing instrumentation. Instrumentation MUST NOT include phone numbers, customer identity, email, request headers, tokens, payment data, or raw query values.

## Acceptance criteria

- A fast offer resolves before the budget and is stored before booking opens.
- A request still pending at 1,500 ms is aborted; booking opens without an offer.
- A rejected request opens booking without an offer.
- The booking override equals the selected past-class context in every outcome.
- Tests deterministically assert the 1,500 ms client budget and safe duration-only timing fields.
