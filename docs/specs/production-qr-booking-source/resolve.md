# Production QR Booking Source Hotfix — Resolved Contract

| Question | Decision |
| --- | --- |
| Signed-in QR classification | Always request server eligibility for a signed-in QR customer. A caller-controlled `newStudent=1` marker cannot bypass established-customer classification. |
| Genuine new students | Keep `checkin-new` when the eligibility endpoint reports no successful purchase or package. |
| Grant completion window | Use a 30-minute default lifetime, still bound to terminal, course, date, time, purpose, signature, and expiry. |
| Public booking | Remains card-only; query markers never substitute for a signed grant. |
| Failure behavior | Invalid, tampered, mismatched, or expired grants fail closed before side effects. |
| Delivery | Keep changes on `fix/production-qr-booking-source`; do not merge or deploy. |
