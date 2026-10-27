# Requirements

## R1 — Client-side QR booking navigation

> “Evitar las recargas completas: que el paso checkin → clase → sign-in → clase use navegación interna, sin recargar la página, sobre todo el ida y vuelta por sign-in.”

- The QR welcome screen must use Next.js client navigation to open the selected class booking route.
- The QR welcome screen must use Next.js client navigation to open sign-in.
- The local sign-in success path must return through Next.js client navigation.
- Existing class, date, time, duration, cash-grant, enrollment, and resume-step query context must remain intact.
- External payment-provider navigation remains a full-document redirect because it leaves the application origin.

## R2 — Stripe single-flight feedback

> “Deshabilitar el botón y mostrar 'cargando' mientras se abre Stripe, para que no se toque varias veces.”

- Checkout submission must reject a second invocation synchronously while the first invocation is active.
- The final action must remain disabled and visibly display its processing state while checkout is created and while hosted Stripe navigation begins.
- A recoverable failure must release the lock so the customer can retry.

## R3 — Cash QR timer ownership

> “Revisar los temporizadores del QR de efectivo, que se acumulan.”

- Each mounted cash-authorized QR component must own at most one refresh timer and one expiry timer.
- Replacing a grant must cancel timers associated with the previous grant.
- URL/context changes and unmount must cancel both timers.
- Stale responses must not update the QR or schedule new timers.
