import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const isDevelopment = process.env.NODE_ENV === "development"
const devDistId = process.env.PORT?.trim() || String(process.pid)

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
]

const nextConfig: NextConfig = {
  // Avoid webpack chunk corruption when multiple local dev servers or a build/dev run
  // touch the same workspace. Production builds keep the default `.next` directory.
  ...(isDevelopment ? { distDir: `.next-dev-${devDistId}` } : {}),
  // Inline the deploy commit sha into the client bundle regardless of the Vercel
  // "Automatically expose System Environment Variables" project toggle. The kiosk
  // auto-reload watchdog (useKioskDeployRefresh) depends on this being non-empty
  // in production; without it the feature silently no-ops.
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
  },
  experimental: {
    middlewareClientMaxBodySize: "220mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

// Source-map upload requires SENTRY_AUTH_TOKEN. Without it, withSentryConfig
// skips the upload step entirely (dryRun) so local/preview builds without the
// token never fail — only environments with the token configured (e.g. CI
// deploys) get uploaded source maps and release annotations.
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  dryRun: !process.env.SENTRY_AUTH_TOKEN,

  // Reduce Sentry's build-time footprint; only opt in to extras we use.
  widenClientFileUpload: false,
  webpack: {
    automaticVercelMonitors: false,
    treeshake: {
      removeDebugLogging: true,
    },
  },
}

export default withSentryConfig(nextConfig, sentryBuildOptions)
