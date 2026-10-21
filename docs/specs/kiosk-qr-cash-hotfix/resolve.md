# Kiosk QR Cash Hotfix — Resolved Contract

| Question | Decision |
| --- | --- |
| Cash authority | Short-lived signed grant minted only after terminal-session authorization. |
| Grant binding | Purpose, terminal identity, course slug, date, time, issued-at, and expiry. |
| Storage | Stateless signed payload; no schema change. |
| QR rendering | Render signed kiosk URLs locally with `qrcode.react`; never disclose bearer grants to an external QR-image service. The dependency is narrowly justified because the repository has no local QR encoder and a remote encoder would receive replayable authorization. |
| Phone UI | Grant presence enables the cash choice; API verification remains authoritative. |
| Public booking | No grant is issued; card/wallet only. Client markers never substitute for a grant. |
| Settlement | QR-phone cash creates a pending kiosk-attributed purchase only. |
| Special classes | QR-phone cash is rejected; immediate cash admission remains terminal-only. |
| Failure mode | Missing, malformed, expired, tampered, or mismatched grants fail closed before side effects. |
