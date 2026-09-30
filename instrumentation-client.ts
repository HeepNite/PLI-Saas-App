// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

import { resolveSentryRuntimeConfig } from "./lib/sentry/runtime-config"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const sentryRuntimeConfig = resolveSentryRuntimeConfig({
  SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
})

Sentry.init({
  dsn,
  // Sentry stays fully inert (no-op) when no DSN is configured, e.g. local
  // dev or preview environments that don't set NEXT_PUBLIC_SENTRY_DSN.
  enabled: Boolean(dsn),

  // Modest trace sampling — this is a small studio app, not a high-traffic
  // service. Tune upward only if performance data proves useful.
  tracesSampleRate: 0.1,
  release: sentryRuntimeConfig.release,
  environment: sentryRuntimeConfig.environment,

  debug: false,
})

// Required by @sentry/nextjs to capture navigation transitions in the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
