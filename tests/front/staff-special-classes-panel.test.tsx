// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import StaffSpecialClassesPanel from "@/components/front/staff/StaffSpecialClassesPanel"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const linkedSummary = {
  id: "class_linked",
  slug: "linked-class",
  title: "Linked class",
  status: "published",
  capacity: 12,
  remaining: 8,
  held: 1,
  paid: 3,
  checkedIn: 2,
  session: { startsAt: "2030-06-01T14:00:00.000Z" },
  authoringCourse: { id: "course_1", title: "Source course" },
}

const standaloneSummary = {
  ...linkedSummary,
  id: "class_standalone",
  slug: "standalone-class",
  title: "Standalone class",
  status: "draft",
  authoringCourse: null,
}

const linkedDetail = {
  ...linkedSummary,
  description: "Managed in Course Studio",
  priceCents: 3200,
  currency: "usd",
  coverImageUrl: null,
  classSession: { ...linkedSummary.session, durationMinutes: 75, location: "Studio A", capacity: 12 },
  metrics: { capacity: 12, available: 8, held: 1, paid: 3, checkedIn: 2 },
  roster: [{ id: "purchase_1", name: "Taylor", email: "taylor@example.com", phone: null, status: "paid", attendance: { id: "attendance_1", status: "scheduled" } }],
  auditLogs: [{ id: "audit_1", action: "class_published", actorRole: "owner", createdAt: "2030-05-01T12:00:00.000Z" }],
}

describe("StaffSpecialClassesPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.unstubAllGlobals()
  })

  it("removes definition authoring controls for every staff role", () => {
    for (const currentRole of ["owner", "admin", "staff"] as const) {
      const html = renderToStaticMarkup(<StaffSpecialClassesPanel visible currentRole={currentRole} onOpenCourseStudio={vi.fn()} />)
      expect(html).toContain("Special Classes")
      expect(html).not.toContain("Create draft")
      expect(html).not.toContain("Edit class definition")
      expect(html).not.toContain('name="title"')
      expect(html).not.toContain('name="startsAt"')
    }
  })

  async function renderPanel(onOpenCourseStudio = vi.fn()) {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith("/class_linked") ? { item: linkedDetail } : { items: [linkedSummary, standaloneSummary] }
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
    }))
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root?.render(<StaffSpecialClassesPanel visible currentRole="owner" onOpenCourseStudio={onOpenCourseStudio} />))
    return { node: container, onOpenCourseStudio }
  }

  it("keeps lifecycle metrics and makes linked versus standalone authoring explicit", async () => {
    const { node, onOpenCourseStudio } = await renderPanel()

    expect(node.textContent).toContain("Capacity")
    expect(node.textContent).toContain("Available")
    expect(node.textContent).toContain("Close sales")
    expect(node.textContent).toContain("Cancel class")
    expect(node.textContent).toContain("Standalone")
    expect(node.textContent).toContain("Publish")

    const openBuilder = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Open in School Builder")
    await act(async () => openBuilder?.click())
    expect(onOpenCourseStudio).toHaveBeenCalledWith("course_1")
  })

  it("keeps roster, operational price/capacity, attendance, and audit controls", async () => {
    const { node } = await renderPanel()
    const details = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Details")
    await act(async () => details?.click())

    expect(node.textContent).toContain("Operational adjustments")
    expect(node.querySelector('input[name="capacity"]')).not.toBeNull()
    expect(node.querySelector('input[name="price"]')).not.toBeNull()
    expect(node.querySelector('input[name="title"]')).toBeNull()
    expect(node.querySelector('input[name="description"]')).toBeNull()
    expect(node.textContent).toContain("Taylor")
    expect(node.textContent).toContain("Check in")
    expect(node.textContent).toContain("Activity history")
    expect(node.textContent).toContain("Class published")
  })
})
