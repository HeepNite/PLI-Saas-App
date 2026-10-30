# Analysis

Production is deployed from `origin/main@2068da88`.

- `CheckInPageRouter` uses `window.location.href` for welcome-to-class and a plain anchor for welcome-to-sign-in.
- `EmbeddedSignIn` falls back to `window.location.assign` after local sign-in.
- Hosted Stripe intentionally requires a full navigation, but checkout locking currently relies primarily on React state becoming visible before a second event.
- `KioskClassQrCode` cleans timers on effect teardown. Its normal sequence does not leak timers, but replacement is implicit and direct cleanup/rescheduling coverage is missing.
- Multiple visible QR cards intentionally create independent timer pairs; this scope guarantees ownership per component rather than reducing the number of visible QRs.
