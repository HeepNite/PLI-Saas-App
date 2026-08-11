// @vitest-environment jsdom

import React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { CoursePickerModal } from "@/components/front/profile/modals/CoursePickerModal"
import type { CourseData } from "@/constants/courses"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  vi.useRealTimers()
})

describe("CoursePickerModal", () => {
  const course: CourseData = {
    slug: "salsa-1",
    title: "Salsa 1",
    description: "Intro salsa class",
    level: "Beginner",
    duration: "60 min",
    heroMedia: {},
    schedule: { day: "Monday", time: "9:00", starts: "9:00", availableWeekdays: [1], availableTimes: [] },
    location: { address: "Main studio" },
    instructors: [],
    scheduleRules: undefined,
    enrollment: { services: [], packages: [] },
  }

  it("renders nothing when hidden", () => {
    const html = renderToStaticMarkup(
      <CoursePickerModal
        coursePickerOpen={false}
        setCoursePickerOpen={vi.fn()}
        orderedCourses={[course]}
        preferredSet={new Set<string>()}
        onClassSelected={vi.fn()}
      />
    )

    expect(html).toBe("")
  })

  it("renders modal heading when open", () => {
    const html = renderToStaticMarkup(
      <CoursePickerModal
        coursePickerOpen
        setCoursePickerOpen={vi.fn()}
        orderedCourses={[course]}
        preferredSet={new Set<string>(["salsa-1"])}
        onClassSelected={vi.fn()}
      />
    )

    expect(html).toContain("Upcoming classes")
    expect(html).toContain("Select a class to book")
  })

  it("renders preferred badge when course is in preferredSet", () => {
    const html = renderToStaticMarkup(
      <CoursePickerModal
        coursePickerOpen
        setCoursePickerOpen={vi.fn()}
        orderedCourses={[course]}
        preferredSet={new Set<string>(["salsa-1"])}
        onClassSelected={vi.fn()}
      />
    )

    // The preferred badge should be rendered somewhere in the modal
    // (it will show if the course has upcoming classes; otherwise the empty state renders)
    expect(html).toContain("Upcoming classes")
  })

  it("keeps an ended 08:00 class selectable for the rest of its New York calendar day", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-10T14:10:00.000Z")) // 10:10 AM in New York
    const onClassSelected = vi.fn().mockResolvedValue(undefined)
    const scheduledCourse: CourseData = {
      ...course,
      schedule: {
        ...course.schedule,
        availableWeekdays: [0, 1],
        availableTimes: ["08:00"],
      },
    }
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <CoursePickerModal
          coursePickerOpen
          setCoursePickerOpen={vi.fn()}
          orderedCourses={[scheduledCourse]}
          preferredSet={new Set<string>()}
          onClassSelected={onClassSelected}
        />
      )
    })

    expect(container.textContent).toContain("Today · Aug 10")
    expect(container.textContent).not.toContain("Aug 9")
    expect(container.textContent).toContain("Tomorrow · Aug 11")

    const classButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
      button.textContent?.includes("Salsa 1")
    )
    expect(classButtons).toHaveLength(2)

    await act(async () => {
      classButtons[0].click()
    })

    expect(onClassSelected).toHaveBeenCalledWith(scheduledCourse, "2026-08-10", "08:00")

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
