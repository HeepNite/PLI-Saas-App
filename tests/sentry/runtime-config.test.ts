import { afterEach, describe, expect, it, vi } from "vitest"

const { withSentryConfig } = vi.hoisted(() => ({
  withSentryConfig: vi.fn((config: unknown, options: unknown) => {
    void options
    return config
  }),
}))

vi.mock("@sentry/nextjs", () => ({ withSentryConfig }))

import { resolveSentryRuntimeConfig } from "@/lib/sentry/runtime-config"

async function loadNextConfigWithSentryMetadata(metadata: Record<string, string>) {
  for (const [name, value] of Object.entries(metadata)) {
    vi.stubEnv(name, value)
  }

  vi.resetModules()
  return (await import("@/next.config")).default
}

afterEach(() => {
  vi.unstubAllEnvs()
  withSentryConfig.mockClear()
})

describe("resolveSentryRuntimeConfig", () => {
  it("prefers an explicit release and environment", () => {
    expect(
      resolveSentryRuntimeConfig({
        SENTRY_RELEASE: " release-2026.09.29 ",
        SENTRY_ENVIRONMENT: " PRODUCTION ",
        VERCEL_GIT_COMMIT_SHA: "vercel-sha",
        VERCEL_ENV: "preview",
        NODE_ENV: "development",
      }),
    ).toEqual({ release: "release-2026.09.29", environment: "production" })
  })

  it("uses Vercel deployment metadata when explicit values are absent", () => {
    expect(
      resolveSentryRuntimeConfig({
        VERCEL_GIT_COMMIT_SHA: "vercel-sha",
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
      }),
    ).toEqual({ release: "vercel-sha", environment: "preview" })
  })

  it("uses NODE_ENV only after Vercel environment and normalizes unknown values", () => {
    expect(resolveSentryRuntimeConfig({ NODE_ENV: "TEST" })).toEqual({ release: undefined, environment: "development" })
  })

  it("does not fabricate a release when deployment metadata is absent", () => {
    expect(resolveSentryRuntimeConfig({ NODE_ENV: "production" }).release).toBeUndefined()
  })

  it("exports the plain Next config without complete secure build metadata", async () => {
    const nextConfig = await loadNextConfigWithSentryMetadata({
      SENTRY_RELEASE: "test-release",
      SENTRY_AUTH_TOKEN: "",
      SENTRY_ORG: "test-org",
      SENTRY_PROJECT: "test-project",
      SENTRY_ENVIRONMENT: "production",
    })

    expect(withSentryConfig).not.toHaveBeenCalled()
    expect(nextConfig.env).not.toHaveProperty("SENTRY_AUTH_TOKEN")
  })

  it("wraps only complete secure metadata with an explicit release deploy configuration", async () => {
    await loadNextConfigWithSentryMetadata({
      SENTRY_RELEASE: "test-release",
      SENTRY_AUTH_TOKEN: "test-token",
      SENTRY_ORG: "test-org",
      SENTRY_PROJECT: "test-project",
      SENTRY_ENVIRONMENT: "production",
    })

    expect(withSentryConfig).toHaveBeenCalledTimes(1)
    expect(withSentryConfig).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        org: "test-org",
        project: "test-project",
        authToken: "test-token",
        release: {
          name: "test-release",
          create: true,
          finalize: true,
          deploy: { env: "production" },
        },
      }),
    )
    expect(withSentryConfig.mock.calls[0]?.[1]).not.toHaveProperty("dryRun")
  })
})
