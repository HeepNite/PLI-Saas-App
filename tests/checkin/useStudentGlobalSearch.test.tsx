// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useStudentGlobalSearch } from "@/components/front/staff/useStudentGlobalSearch"

type HookSnapshot = ReturnType<typeof useStudentGlobalSearch>

const createJsonResponse = (payload: unknown, ok = true, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response

const renderHarness = async (initial: { query: string; isHistoryMode?: boolean; hasClientMatches?: boolean } = { query: "" }) => {
  let snapshot: HookSnapshot | null = null
  let setQuery = (_value: string) => {}
  let setHistoryMode = (_value: boolean) => {}
  let setHasClientMatches = (_value: boolean) => {}

  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  function Harness() {
    const [query, updateQuery] = React.useState(initial.query)
    const [isHistoryMode, updateHistoryMode] = React.useState(Boolean(initial.isHistoryMode))
    const [hasClientMatches, updateHasClientMatches] = React.useState(Boolean(initial.hasClientMatches))

    setQuery = updateQuery
    setHistoryMode = updateHistoryMode
    setHasClientMatches = updateHasClientMatches

    snapshot = useStudentGlobalSearch({ query, isHistoryMode, hasClientMatches })
    return null
  }

  await act(async () => {
    root.render(<Harness />)
  })

  return {
    root,
    container,
    getSnapshot: () => {
      if (!snapshot) throw new Error("hook snapshot not ready")
      return snapshot
    },
    setQuery: async (value: string) => {
      await act(async () => {
        setQuery(value)
      })
    },
    setHistoryMode: async (value: boolean) => {
      await act(async () => {
        setHistoryMode(value)
      })
    },
    setHasClientMatches: async (value: boolean) => {
      await act(async () => {
        setHasClientMatches(value)
      })
    },
  }
}

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

describe("useStudentGlobalSearch", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn())
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("does not trigger global search when query is shorter than 2 chars, history mode is active, or client matches already exist", async () => {
    const rendered = await renderHarness({ query: "a" })
    root = rendered.root
    container = rendered.container

    await act(async () => {
      vi.advanceTimersByTime(350)
    })
    expect(fetch).not.toHaveBeenCalled()

    await rendered.setQuery("ana")
    await rendered.setHistoryMode(true)
    await act(async () => {
      vi.advanceTimersByTime(350)
    })
    expect(fetch).not.toHaveBeenCalled()

    await rendered.setHistoryMode(false)
    await rendered.setHasClientMatches(true)
    await act(async () => {
      vi.advanceTimersByTime(350)
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("fires after 300ms and stores successful results", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse({ results: [{ source: "profile", key: "user_1", userId: "user_1", displayName: "Ana", email: "ana@example.com", phone: null, avatarUrl: null, registeredAt: "2026-04-01T00:00:00.000Z", checkInStatus: "none", latestClassAttended: null, lastPayment: null, lastCourse: null, paymentStatus: null, activePackage: null, remainingCredits: null, outstandingBalance: null, pinStatus: "none", cashSettlement: null, pointsBalance: 0 }] }))

    const rendered = await renderHarness({ query: "ana" })
    root = rendered.root
    container = rendered.container

    await act(async () => {
      vi.advanceTimersByTime(299)
    })
    expect(fetch).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(rendered.getSnapshot().searchResultCards?.[0]?.displayName).toBe("Ana")
    expect(rendered.getSnapshot().isGlobalSearchLoading).toBe(false)
  })

  it("discards stale responses when a newer query is already active", async () => {
    let resolveFirst: ((value: Response) => void) | null = null
    vi.mocked(fetch)
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveFirst = resolve
      }))
      .mockResolvedValueOnce(createJsonResponse({ results: [{ source: "profile", key: "user_new", userId: "user_new", displayName: "Newest", email: "new@example.com", phone: null, avatarUrl: null, registeredAt: "2026-04-01T00:00:00.000Z", checkInStatus: "none", latestClassAttended: null, lastPayment: null, lastCourse: null, paymentStatus: null, activePackage: null, remainingCredits: null, outstandingBalance: null, pinStatus: "none", cashSettlement: null, pointsBalance: 0 }] }))

    const rendered = await renderHarness({ query: "ana" })
    root = rendered.root
    container = rendered.container

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await rendered.setQuery("anabella")
    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    await act(async () => {
      resolveFirst?.(createJsonResponse({ results: [{ source: "profile", key: "user_old", userId: "user_old", displayName: "Old", email: "old@example.com", phone: null, avatarUrl: null, registeredAt: "2026-04-01T00:00:00.000Z", checkInStatus: "none", latestClassAttended: null, lastPayment: null, lastCourse: null, paymentStatus: null, activePackage: null, remainingCredits: null, outstandingBalance: null, pinStatus: "none", cashSettlement: null, pointsBalance: 0 }] }))
      await Promise.resolve()
    })

    expect(rendered.getSnapshot().searchResultCards?.[0]?.displayName).toBe("Newest")
  })

  it("resets state on clear and exposes inline errors for failed responses and network failures", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(createJsonResponse({ error: "Search failed badly" }, false, 500))
      .mockRejectedValueOnce(new Error("network"))

    const rendered = await renderHarness({ query: "ana" })
    root = rendered.root
    container = rendered.container

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })
    expect(rendered.getSnapshot().globalSearchError).toBe("Search failed badly")

    await rendered.setQuery("anabella")
    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })
    expect(rendered.getSnapshot().globalSearchError).toBe("Network error. Please try again.")

    await rendered.setQuery("")
    expect(rendered.getSnapshot().searchResultCards).toBeNull()
    expect(rendered.getSnapshot().globalSearchError).toBeNull()
    expect(rendered.getSnapshot().isGlobalSearchLoading).toBe(false)
  })
})
