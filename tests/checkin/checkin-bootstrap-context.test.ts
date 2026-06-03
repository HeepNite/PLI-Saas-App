import { describe, expect, it } from "vitest"

import { resolveCheckInBootstrapContextPayload } from "@/lib/checkin/checkin-bootstrap-context"

describe("resolveCheckInBootstrapContextPayload", () => {
  it("uses the active class context by default", () => {
    expect(
      resolveCheckInBootstrapContextPayload({
        activeCourseSlug: "salsa",
        activeDate: "2026-06-03",
        activeTime: "20:00",
        durationMinutes: 60,
        latePaymentEntryOverride: null,
      })
    ).toEqual({
      courseSlug: "salsa",
      date: "2026-06-03",
      time: "20:00",
      durationMinutes: 60,
      linkedFromCourseSlug: "salsa",
    })
  })

  it("uses late-payment override context while preserving active duration", () => {
    expect(
      resolveCheckInBootstrapContextPayload({
        activeCourseSlug: "salsa",
        activeDate: "2026-06-03",
        activeTime: "20:00",
        durationMinutes: 75,
        latePaymentEntryOverride: {
          courseSlug: "bachata",
          date: "2026-06-04",
          time: "18:30",
        },
      })
    ).toEqual({
      courseSlug: "bachata",
      date: "2026-06-04",
      time: "18:30",
      durationMinutes: 75,
      linkedFromCourseSlug: "bachata",
    })
  })
})
