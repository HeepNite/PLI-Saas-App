// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import StudentDataOverrideModal from "@/components/front/staff/StudentDataOverrideModal"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

describe("StudentDataOverrideModal cash package picker", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function renderModal(role: "owner" | "admin" | "staff", category: "front_desk" | "teacher" | "guest" = "front_desk", subCategory: "teacher" | null = null) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StudentDataOverrideModal open onClose={vi.fn()} studentId="student-1" studentName="Student One" currentRole={role} currentCategory={category} currentSubCategory={subCategory} />))
    return container
  }

  it("hides the cash package picker for a legacy teacher category", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ courses: [] }))))
    const node = await renderModal("staff", "teacher")
    await act(async () => Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Package")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    expect(node.querySelector("select[name='cash-package-plan']")).toBeNull()
  })

  it("hides the cash package picker for a normalized teacher category", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ courses: [] }))))
    const node = await renderModal("staff", "guest", "teacher")
    await act(async () => Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Package")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    expect(node.querySelector("select[name='cash-package-plan']")).toBeNull()
  })
})
