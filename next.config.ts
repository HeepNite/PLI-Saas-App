import type { NextConfig } from "next"

const isDevelopment = process.env.NODE_ENV === "development"
const isDemo = process.env.DEMO_MODE === "true"
const devDistId = process.env.PORT?.trim() || String(process.pid)

// Demo mode is local-only — block production builds to prevent accidental deploys
if (isDemo && !isDevelopment) {
  throw new Error(
    "[DEMO_MODE] This branch is for local demos only. " +
    "Remove DEMO_MODE=true or switch to a non-demo branch to build for production."
  )
}

const nextConfig: NextConfig = {
  // Avoid webpack chunk corruption when multiple local dev servers or a build/dev run
  // touch the same workspace. Production builds keep the default `.next` directory.
  ...(isDevelopment ? { distDir: `.next-dev-${devDistId}` } : {}),
  experimental: {
    middlewareClientMaxBodySize: "220mb",
  },
}

export default nextConfig
