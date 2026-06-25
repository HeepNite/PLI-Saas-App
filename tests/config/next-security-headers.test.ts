import { describe, expect, it } from "vitest"

import nextConfig from "@/next.config"

describe("Next.js security headers", () => {
  it("applies baseline security headers to every route", async () => {
    expect(nextConfig.headers).toBeTypeOf("function")

    const headers = await nextConfig.headers?.()

    expect(headers).toEqual([
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ])
  })
})
