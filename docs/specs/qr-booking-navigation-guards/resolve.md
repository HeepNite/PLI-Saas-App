# Resolved contract

1. Use Next.js `router.push` or `Link` for same-origin QR booking transitions.
2. For validated QR `/checkin` redirects, render the existing embedded phone/SMS sign-in and use client-side replacement after success. Keep the ordinary Clerk multi-method widget unchanged for non-QR sign-in; do not change external Stripe redirects.
3. Preserve the complete existing redirect URL rather than reconstructing booking context after authentication.
4. Add a synchronous ref-based checkout lock in addition to the rendered `processing` state.
5. Keep the lock set when hosted Stripe navigation starts; clear it on every recoverable completion or error.
6. Make QR timer replacement explicit before scheduling the next refresh/expiry pair; cleanup remains mandatory on context change and unmount.
7. Do not alter pricing, cash authorization, grant TTL, authentication rules, or payment-provider contracts.
