import { describe, expect, it } from "vitest"
import {
  excludeSelectedTerminalPastClass,
  resolveActiveTerminalSession,
  sortTerminalSessions,
} from "@/components/front/staff/StaffTerminalShell"

const session = (overrides: Partial<{
  courseSlug: string
  date: string
  time: string
  durationMinutes: number | null
}> = {}) => ({
  courseSlug: "salsa-nocturno",
  date: "2026-06-09",
  time: "19:00",
  durationMinutes: 60,
  ...overrides,
})

describe("excludeSelectedTerminalPastClass", () => {
  it("removes only the selected Tuesday session while retaining a later session of the same course", () => {
    const currentSession = {
      courseSlug: "salsa-nocturno",
      date: "2026-06-09",
      time: "19:00",
    }
    const laterSession = {
      courseSlug: "salsa-nocturno",
      date: "2026-06-09",
      time: "20:30",
    }

    const pastClasses = excludeSelectedTerminalPastClass(
      [currentSession, laterSession],
      currentSession,
    )

    expect(pastClasses).toEqual([laterSession])
  })

  it("keeps a distinct course scheduled at the same Tuesday time", () => {
    const activeSession = session({ courseSlug: "bachata-social" })
    const sameTimeSession = session({ courseSlug: "salsa-nocturno" })

    expect(excludeSelectedTerminalPastClass([activeSession, sameTimeSession], activeSession)).toEqual([
      sameTimeSession,
    ])
  })
})

describe("terminal session selection", () => {
  it("orders equal start times by course slug", () => {
    const bachataSession = session({ courseSlug: "bachata-social", time: "19:00" })
    const salsaSession = session({ courseSlug: "salsa-nocturno", time: "19:00" })
    const laterSession = session({ courseSlug: "zouk-lab", time: "20:30" })

    expect(sortTerminalSessions([salsaSession, laterSession, bachataSession])).toEqual([
      bachataSession,
      salsaSession,
      laterSession,
    ])
  })

  it("uses the exact selected after-hours session and leaves every other session past", () => {
    const bachataSession = session({ courseSlug: "bachata-social", time: "19:00" })
    const salsaSession = session({ courseSlug: "salsa-nocturno", time: "19:00" })
    const previousSalsaSession = session({ date: "2026-06-02" })
    const laterSession = session({ courseSlug: "zouk-lab", time: "20:30" })

    const activeSession = resolveActiveTerminalSession(
      [bachataSession, previousSalsaSession, salsaSession, laterSession],
      salsaSession,
    )

    expect(activeSession).toEqual(salsaSession)
    expect(excludeSelectedTerminalPastClass(
      [bachataSession, previousSalsaSession, salsaSession, laterSession],
      activeSession!,
    )).toEqual([bachataSession, previousSalsaSession, laterSession])
  })
})
