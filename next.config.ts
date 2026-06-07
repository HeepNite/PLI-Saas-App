import type { NextConfig } from "next"

const isDevelopment = process.env.NODE_ENV === "development"
const devDistId = process.env.PORT?.trim() || String(process.pid)

const nextConfig: NextConfig = {
  // Avoid webpack chunk corruption when multiple local dev servers or a build/dev run
  // touch the same workspace. Production builds keep the default `.next` directory.
  ...(isDevelopment ? { distDir: `.next-dev-${devDistId}` } : {}),
  experimental: {
    middlewareClientMaxBodySize: "220mb",
  },
}

export default nextConfig
