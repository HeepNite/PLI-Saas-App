import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { CoursePickerModal } from "@/components/front/profile/modals/CoursePickerModal"

describe("CoursePickerModal", () => {
  const course = {
    slug: "salsa-1",
    title: "Salsa 1",
    level: "Beginner",
    duration: "60 min",
    heroMedia: { image: null },
    schedule: { day: "Monday", time: "9:00", availableWeekdays: [1] },
    location: { address: "Main studio" },
  }

  it("renders nothing when hidden", () => {
    const html = renderToStaticMarkup(
      <CoursePickerModal
        coursePickerOpen={false}
        setCoursePickerOpen={vi.fn()}
        orderedCourses={[course] as any}
        preferredSet={new Set<string>()}
        setSelectedCourse={vi.fn()}
        setEnrollOpen={vi.fn()}
      />
    )

    expect(html).toBe("")
  })

  it("renders preferred badge and booking copy", () => {
    const html = renderToStaticMarkup(
      <CoursePickerModal
        coursePickerOpen
        setCoursePickerOpen={vi.fn()}
        orderedCourses={[course] as any}
        preferredSet={new Set<string>(["salsa-1"])}
        setSelectedCourse={vi.fn()}
        setEnrollOpen={vi.fn()}
      />
    )

    expect(html).toContain("Choose the class you want to book")
    expect(html).toContain("Preferred")
    expect(html).toContain("Book")
  })

  it("wires course selection callbacks", () => {
    const setSelectedCourse = vi.fn()
    const setCoursePickerOpen = vi.fn()
    const setEnrollOpen = vi.fn()

    const element = CoursePickerModal({
      coursePickerOpen: true,
      setCoursePickerOpen,
      orderedCourses: [course] as any,
      preferredSet: new Set<string>(),
      setSelectedCourse,
      setEnrollOpen,
    })

    const stack = [element as any]
    while (stack.length) {
      const node = stack.pop()
      if (!node?.props) continue
      if (node.type === "button" && node.props.onClick && node.key === "salsa-1") {
        node.props.onClick()
        break
      }
      const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children]
      for (const child of children) stack.push(child)
    }

    expect(setSelectedCourse).toHaveBeenCalledWith(course)
    expect(setCoursePickerOpen).toHaveBeenCalledWith(false)
    expect(setEnrollOpen).toHaveBeenCalledWith(true)
  })
})
