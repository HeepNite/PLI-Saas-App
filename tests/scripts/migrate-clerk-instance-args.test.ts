import { describe, expect, it } from "vitest"

import { isPlaceholderEmail, parseMigrateArgs } from "@/scripts/migrate-clerk-instance"

describe("parseMigrateArgs", () => {
  it("defaults to dry-run mode with no flags", () => {
    expect(parseMigrateArgs([])).toEqual({
      mode: "dry-run",
      limit: undefined,
      delta: false,
      userId: undefined,
      remap: false,
      rollback: false,
    })
  })

  it("parses explicit --mode=write, --limit, --userId, --delta, --remap", () => {
    expect(parseMigrateArgs(["--mode=write", "--limit=5", "--userId=user_123", "--delta", "--remap"])).toEqual({
      mode: "write",
      limit: 5,
      delta: true,
      userId: "user_123",
      remap: true,
      rollback: false,
    })
  })

  it("parses --rollback", () => {
    expect(parseMigrateArgs(["--rollback"])).toMatchObject({ rollback: true })
  })

  it("rejects an invalid --mode value", () => {
    expect(() => parseMigrateArgs(["--mode=boom"])).toThrow("Invalid --mode value: boom. Expected dry-run or write.")
  })

  it("rejects a non-positive --limit value", () => {
    expect(() => parseMigrateArgs(["--limit=0"])).toThrow("Invalid --limit value: 0. Expected a positive integer.")
  })
})

describe("isPlaceholderEmail", () => {
  it("matches the phone-{phone}-{timestamp}@placeholder.pli.local pattern regardless of the timestamp segment", () => {
    expect(isPlaceholderEmail("phone-12125551234-1700000000000@placeholder.pli.local")).toBe(true)
    expect(isPlaceholderEmail("phone-12125559999-999@placeholder.pli.local")).toBe(true)
  })

  it("does not match a real email address", () => {
    expect(isPlaceholderEmail("ana@example.com")).toBe(false)
  })

  it("does not match null or undefined", () => {
    expect(isPlaceholderEmail(null)).toBe(false)
    expect(isPlaceholderEmail(undefined)).toBe(false)
  })
})
