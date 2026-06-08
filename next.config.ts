import type { NextConfig } from "next"

const isDevelopment = process.env.NODE_ENV === "development"
const devDistId = process.env.PORT?.trim() || String(process.pid)

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

const nextConfig: NextConfig = {
  // Avoid webpack chunk corruption when multiple local dev servers or a build/dev run
  // touch the same workspace. Production builds keep the default `.next` directory.
  ...(isDevelopment ? { distDir: `.next-dev-${devDistId}` } : {}),
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

export default nextConfig
