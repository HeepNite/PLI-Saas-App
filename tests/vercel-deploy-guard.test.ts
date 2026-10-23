import { describe, expect, it } from "vitest"
import { checkVercelDeploy } from "../scripts/vercel-deploy-guard.mjs"

describe("checkVercelDeploy", () => {
  it("allows builds outside Vercel", () => {
    expect(checkVercelDeploy({}).ok).toBe(true)
  })

  it("allows production from main and preview from codex/develop", () => {
    expect(checkVercelDeploy({ VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }).ok).toBe(true)
    expect(checkVercelDeploy({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "codex/develop" }).ok).toBe(true)
  })

  it("blocks a production deploy from a local folder with no git branch", () => {
    const result = checkVercelDeploy({ VERCEL: "1", VERCEL_ENV: "production" })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain("no git branch")
  })

  it("blocks production from any branch other than main", () => {
    expect(checkVercelDeploy({ VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "codex/develop" }).ok).toBe(false)
  })

  it("blocks preview from any branch other than codex/develop", () => {
    expect(checkVercelDeploy({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "fix/something" }).ok).toBe(false)
    expect(checkVercelDeploy({ VERCEL: "1", VERCEL_ENV: "preview" }).ok).toBe(false)
  })
})
