// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"

import StaffCoursePromotionsStep from "@/components/front/staff/StaffCoursePromotionsStep"
import type { CourseFormState } from "@/components/front/staff/staffAdminTypes"

const form = { promotions: [] } as unknown as CourseFormState

describe("StaffCoursePromotionsStep", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove(); root = null; container = null
  })

  const render = async (initial = form) => {
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container)
    function Harness() {
      const [courseForm, setCourseForm] = React.useState(initial)
      return <StaffCoursePromotionsStep visible courseForm={courseForm} setCourseForm={setCourseForm} />
    }
    await act(async () => root!.render(<Harness />))
    return container
  }

  it("adds, edits, activates, and removes a promotion", async () => {
    const node = await render()
    await act(async () => node.querySelector<HTMLButtonElement>("button")!.click())
    expect(node.textContent).toContain("Promotion 1")

    const label = node.querySelector<HTMLInputElement>('input[aria-label="Promotion 1 label"]')!
    await act(async () => { label.value = "Halloween"; label.dispatchEvent(new Event("input", { bubbles: true })) })
    expect(label.value).toBe("Halloween")

    const active = Array.from(node.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((input) => input.parentElement?.textContent === "Active")!
    await act(async () => active.click())
    expect(active.checked).toBe(true)

    const remove = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Remove")!
    await act(async () => remove.click())
    expect(node.textContent).toContain("No promotions configured")
  })

  it("renders audience, date-basis, pricing, and channel controls", async () => {
    const node = await render({ ...form, promotions: [{
      id: "heritage", label: "Heritage", active: true,
      pricing: { kind: "fixed", amountCents: 1500 },
      window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
      audience: "heritage_pin_delivered", channels: ["public_booking", "profile"],
    }] })
    expect(node.querySelector<HTMLSelectElement>('select[aria-label="Promotion 1 audience"]')?.value).toBe("heritage_pin_delivered")
    expect(node.querySelector<HTMLSelectElement>('select[aria-label="Promotion 1 date basis"]')?.value).toBe("class_date")
    expect(node.querySelector<HTMLInputElement>('input[aria-label="Promotion 1 value"]')?.value).toBe("15")
    expect(Array.from(node.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter((input) => input.checked)).toHaveLength(3)
  })
})
