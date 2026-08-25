import { describe, expect, it } from "vitest"

import { resolveAvatarState, type ClerkUser } from "@/lib/clerk-users"

const makeClerkUser = (overrides: Partial<ClerkUser> = {}): ClerkUser =>
  ({ hasImage: false, ...overrides }) as ClerkUser

describe("resolveAvatarState", () => {
  it("returns a null avatar state when the user is missing", () => {
    expect(resolveAvatarState(null)).toEqual({
      hasAvatar: null,
      needsRefresh: false,
    })
  })

  it("uses an explicit true avatar signal without requesting refresh", () => {
    expect(resolveAvatarState(makeClerkUser({ hasImage: true }))).toEqual({
      hasAvatar: true,
      needsRefresh: false,
    })
  })

  it("uses an explicit false avatar signal without requesting refresh", () => {
    expect(resolveAvatarState(makeClerkUser({ hasImage: false }))).toEqual({
      hasAvatar: false,
      needsRefresh: false,
    })
  })

  it("marks malformed avatar data as ambiguous and requests refresh", () => {
    const malformedUser = { hasImage: "yes" } as unknown as ClerkUser

    expect(resolveAvatarState(malformedUser)).toEqual({
      hasAvatar: null,
      needsRefresh: true,
    })
  })
})
