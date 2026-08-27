import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import StaffSpecialClassesPanel from "@/components/front/staff/StaffSpecialClassesPanel"

describe("StaffSpecialClassesPanel", () => {
  it("shows management controls to owners and admins", () => {
    expect(renderToStaticMarkup(<StaffSpecialClassesPanel visible currentRole="owner" />)).toContain("Create draft")
    expect(renderToStaticMarkup(<StaffSpecialClassesPanel visible currentRole="admin" />)).toContain("Create draft")
  })

  it("keeps front desk operational view read-only", () => {
    const html = renderToStaticMarkup(<StaffSpecialClassesPanel visible currentRole="staff" />)
    expect(html).toContain("Special Classes")
    expect(html).not.toContain("Create draft")
  })
})
