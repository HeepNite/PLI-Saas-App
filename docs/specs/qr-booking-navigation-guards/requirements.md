# Requirements

## R1 — Client-side QR booking navigation

> “Evitar las recargas completas: que el paso checkin → clase → sign-in → clase use navegación interna, sin recargar la página, sobre todo el ida y vuelta por sign-in.”

- The QR welcome screen must use Next.js client navigation to open the selected class booking route.
- The QR welcome screen must use Next.js client navigation to open sign-in.
- The local sign-in success path must return through Next.js client navigation.
- Existing class, date, time, duration, cash-grant, enrollment, and resume-step query context must remain intact.
- External payment-provider navigation remains a full-document redirect because it leaves the application origin.

## R2 — Stripe single-flight feedback

> “Back-from-Stripe (bfcache): on the hosted redirects (useEnrollPaymentActions.ts ~:612, ~:689) checkoutAttemptRef stays true. If the page is restored with Back, resetForm frees the UI but Pay silently does nothing. Release the ref whenever processing becomes false (or on pageshow with persisted), and add a test.”

- Checkout submission must reject a second invocation synchronously while the first invocation is active.
- The final action must remain disabled and visibly display its processing state while checkout is created and while hosted Stripe navigation begins.
- A recoverable failure or rendered `processing=false` state after bfcache/reset must release the lock so the customer can retry.

## R3 — Cash QR timer ownership

> “KioskClassQrCode: a failed cash-grant refresh blanks the grant and schedules no retry (~:58, ~:67-68), so in-studio QR cash stays unavailable. Add a bounded retry, with a test.”

- Each mounted cash-authorized QR component must own at most one refresh timer and one expiry timer.
- Replacing a grant must cancel timers associated with the previous grant.
- URL/context changes and unmount must cancel both timers.
- Stale responses must schedule nothing; failures retry every five seconds at most three times without hiding an unexpired grant.
