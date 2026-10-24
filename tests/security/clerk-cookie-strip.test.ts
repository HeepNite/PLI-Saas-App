import { describe, expect, it } from "vitest"

import {
  isClerkCookieName,
  isClerkFreeTerminalPath,
  stripClerkCookies,
} from "@/lib/security/clerk-cookie-strip"

describe("isClerkCookieName", () => {
  it.each([
    "__session",
    "__session_AbC123",
    "__client_uat",
    "__client_uat_AbC123",
    "__refresh",
    "__refresh_AbC123",
    "__clerk_db_jwt",
    "__clerk_db_jwt_AbC123",
    "__clerk_handshake",
    "__clerk_handshake_nonce",
    "__clerk_redirect_count",
    "__client",
  ])("treats %s as a Clerk cookie", (name) => {
    expect(isClerkCookieName(name)).toBe(true)
  })

  it.each(["pli_terminal_session", "theme", "session", "_ga", "__stripe_mid", "my__session"])(
    "keeps %s",
    (name) => {
      expect(isClerkCookieName(name)).toBe(false)
    },
  )
})

describe("stripClerkCookies", () => {
  it("removes every Clerk cookie and keeps the terminal session and unrelated cookies", () => {
    const header = [
      "__client_uat=1792800000",
      "__client_uat_AbC123=1792800000",
      "__session=eyJ.a.b",
      "__session_AbC123=eyJ.a.b",
      "__clerk_db_jwt=dvb_1",
      "__refresh_AbC123=r",
      "pli_terminal_session=term-token.sig",
      "theme=dark",
      "__stripe_mid=abc",
    ].join("; ")

    expect(stripClerkCookies(header)).toBe(
      "pli_terminal_session=term-token.sig; theme=dark; __stripe_mid=abc",
    )
  })

  it("preserves cookie values that contain '='", () => {
    expect(stripClerkCookies("__session=x; pli_terminal_session=a=b==")).toBe(
      "pli_terminal_session=a=b==",
    )
  })

  it("returns an empty string when only Clerk cookies are present", () => {
    expect(stripClerkCookies("__client_uat=0; __session=x")).toBe("")
  })
})

describe("isClerkFreeTerminalPath", () => {
  it.each(["/staff/terminal", "/staff/terminal/"])("matches %s", (path) => {
    expect(isClerkFreeTerminalPath(path)).toBe(true)
  })

  it.each([
    "/staff/terminal/setup",
    "/staff/terminals",
    "/staff",
    "/api/staff/terminal",
    "/api/staff/terminal/session",
    "/",
  ])("does not match %s", (path) => {
    expect(isClerkFreeTerminalPath(path)).toBe(false)
  })
})
