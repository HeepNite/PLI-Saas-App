// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffTerminalShell from "@/components/front/staff/StaffTerminalShell"

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/components/front/checkin/CheckInQrClient", () => ({
  default: (props: Record<string, unknown>) => {
    captured.props = { ...props }
    return null
  },
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const beginnerClass = {
  slug: "salsa-night-beginner",
  durationMinutes: 45,
  availableTimes: ["20:10"],
}
const classes = [
  beginnerClass,
  {
    ...beginnerClass,
    durationMinutes: 55,
    availableTimes: ["21:10"],
  },
]

describe("StaffTerminalShell rotation context", () => {
  let root: Root | null = null, container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    captured.props = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each([
    ["at the 20:50 rotation threshold", "2026-05-23T00:50:00.000Z"],
    ["after the previous class ends", "2026-05-23T01:06:00.000Z"],
  ])("keeps the 20:10 class available %s", async (_label, now) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ date: "2026-05-22", classes }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          date: "2026-05-23",
          classes: [{ ...classes[1], availableTimes: ["10:00"] }],
        }),
      }))

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <StaffTerminalShell terminal={{
          id: "terminal-1",
          slug: "front-desk",
          name: "Front Desk",
          location: "Studio",
          defaultCourseSlug: null,
        }} />
      )
      await Promise.resolve()
    })

    expect(captured.props).toMatchObject({
      forcedCourseSlug: "salsa-night-beginner",
      forcedClassContext: {
        courseSlug: "salsa-night-beginner",
        date: "2026-05-22",
        time: "21:10",
        durationMinutes: 55,
      },
      terminalPastClasses: [
        {
          courseSlug: "salsa-night-beginner",
          date: "2026-05-22",
          time: "20:10",
          durationMinutes: 45,
        },
      ],
    })

    await act(async () => vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000))

    expect(captured.props?.forcedClassContext).toMatchObject({ date: "2026-05-23", time: "10:00" })
    expect(captured.props?.terminalPastClasses).not.toContainEqual(
      expect.objectContaining({ date: "2026-05-22" })
    )
  })

  it("keeps the 9:10 PM Friday class current at 11:01 PM and excludes the selected class from past courses", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-23T03:01:00.000Z"))
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-05-22",
        classes: [
          {
            ...beginnerClass,
            slug: "salsa-night-beginner",
            title: "Salsa Beginner / Open Level",
            availableTimes: ["20:10"],
          },
          {
            ...beginnerClass,
            slug: "salsa-night-advance-beginner-rueda",
            title: "Advance Beginner Rueda",
            durationMinutes: 55,
            availableTimes: ["21:10"],
          },
        ],
      }),
    }))

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <StaffTerminalShell terminal={{
          id: "terminal-1",
          slug: "front-desk",
          name: "Front Desk",
          location: "Studio",
          defaultCourseSlug: null,
        }} />
      )
      await Promise.resolve()
    })

    expect(captured.props).toMatchObject({
      forcedCourseSlug: "salsa-night-advance-beginner-rueda",
      forcedClassContext: {
        courseSlug: "salsa-night-advance-beginner-rueda",
        date: "2026-05-22",
        time: "21:10",
      },
      terminalPastClasses: [
        expect.objectContaining({
          courseSlug: "salsa-night-beginner",
          date: "2026-05-22",
          time: "20:10",
        }),
      ],
    })

    const selectPastClass = captured.props?.onTerminalPastClassSelect as ((selection: {
      courseSlug: string
      time: string
    }) => void)

    await act(async () => {
      selectPastClass({ courseSlug: "salsa-night-beginner", time: "20:10" })
    })

    expect(captured.props).toMatchObject({
      forcedCourseSlug: "salsa-night-beginner",
      selectedTerminalPastClass: {
        courseSlug: "salsa-night-beginner",
        time: "20:10",
      },
      terminalPastClasses: [
        expect.objectContaining({
          courseSlug: "salsa-night-advance-beginner-rueda",
          time: "21:10",
        }),
      ],
    })
  })
})
