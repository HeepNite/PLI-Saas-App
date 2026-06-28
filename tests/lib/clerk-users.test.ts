import { afterEach, describe, expect, it, vi } from "vitest"

const mockClerkClient = vi.hoisted(() => vi.fn())

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: mockClerkClient,
}))

import { getCachedClerkUser, resolveAvatarState, type ClerkUser } from "@/lib/clerk-users"

const makeClerkUser = (overrides: Partial<ClerkUser> = {}): ClerkUser =>
  ({ hasImage: false, ...overrides }) as ClerkUser

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("getCachedClerkUser", () => {
  it("deduplicates parallel cold requests for the same user", async () => {
    const pendingUser = deferred<ClerkUser>()
    const getUser = vi.fn().mockReturnValue(pendingUser.promise)
    const user = makeClerkUser({ id: "user_parallel" } as Partial<ClerkUser>)
    mockClerkClient.mockResolvedValue({ users: { getUser } })

    const first = getCachedClerkUser("user_parallel")
    const second = getCachedClerkUser("user_parallel")

    await Promise.resolve()

    expect(getUser).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledWith("user_parallel")

    pendingUser.resolve(user)

    await expect(Promise.all([first, second])).resolves.toEqual([user, user])
  })

  it("clears rejected in-flight requests so a later retry calls Clerk again", async () => {
    const transientError = new Error("Clerk temporarily unavailable")
    const user = makeClerkUser({ id: "user_retry" } as Partial<ClerkUser>)
    const getUser = vi.fn()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce(user)
    mockClerkClient.mockResolvedValue({ users: { getUser } })

    await expect(getCachedClerkUser("user_retry")).rejects.toThrow(transientError)
    await expect(getCachedClerkUser("user_retry")).resolves.toBe(user)

    expect(getUser).toHaveBeenCalledTimes(2)
    expect(getUser).toHaveBeenNthCalledWith(1, "user_retry")
    expect(getUser).toHaveBeenNthCalledWith(2, "user_retry")
  })
})

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
