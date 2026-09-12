import path from "node:path"
import { ESLint } from "eslint"
import { describe, expect, it } from "vitest"

describe("ESLint generated output boundaries", () => {
  const eslint = new ESLint({ cwd: process.cwd() })

  it("ignores generated Next.js development output", async () => {
    const generatedFile = path.join(process.cwd(), ".next-dev-3010/server/app.js")

    await expect(eslint.isPathIgnored(generatedFile)).resolves.toBe(true)
  })

  it("does not ignore application source", async () => {
    const sourceFile = path.join(process.cwd(), "app/(pages)/page.tsx")

    await expect(eslint.isPathIgnored(sourceFile)).resolves.toBe(false)
  })
})
