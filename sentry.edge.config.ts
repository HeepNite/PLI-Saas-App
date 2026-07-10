// This file configures the initialization of Sentry for edge features
// (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  // Sentry stays fully inert (no-op) when no DSN is configured, e.g. local
  // dev or preview environments that don't set NEXT_PUBLIC_SENTRY_DSN.
  enabled: Boolean(dsn),

  // Modest trace sampling — this is a small studio app, not a high-traffic
  // service. Tune upward only if performance data proves useful.
  tracesSampleRate: 0.1,

  debug: false,
})
