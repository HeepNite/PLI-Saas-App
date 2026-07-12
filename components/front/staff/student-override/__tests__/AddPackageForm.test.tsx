// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AddPackageForm } from "@/components/front/staff/student-override/AddPackageForm"
import type { PackagePlanOption } from "@/components/front/staff/student-override/types"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof AddPackageForm>

const plans: PackagePlanOption[] = [
  {
    id: "plan-1",
    key: "unlimited-monthly",
    label: "Unlimited Monthly",
    priceCents: 12000,
    totalCredits: null,
    validDays: 30,
    isUnlimited: true,
    courseSlug: "salsa",
    courseSlugs: ["salsa"],
  },
  {
    id: "plan-2",
    key: "5-class-pack",
    label: "5 Class Pack",
    priceCents: 6000,
    totalCredits: 5,
    validDays: 90,
    isUnlimited: false,
    courseSlug: "salsa",
    courseSlugs: ["salsa"],
  },
]

const createProps = (overrides: Partial<Props> = {}): Props => ({
  plans,
  plansLoading: false,
  plansError: null,
  selectedPlanId: "",
  expiresAt: "",
  reason: "",
  state: "idle",
  errorMessage: null,
  duplicate: null,
  grantedPurchaseId: null,
  onSelectPlan: vi.fn(),
  onExpiresAtChange: vi.fn(),
  onReasonChange: vi.fn(),
  onSubmit: vi.fn(),
  onConfirmDuplicate: vi.fn(),
  onStartAnother: vi.fn(),
  ...overrides,
})

describe("AddPackageForm", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function render(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<AddPackageForm {...props} />))
    return container
  }

  it("renders plans fetched from the picker endpoint in the selector", async () => {
    const node = await render(createProps())
    const options = Array.from(node.querySelectorAll("select option")).map((o) => o.textContent)

    expect(options.some((label) => label?.includes("Unlimited Monthly"))).toBe(true)
    expect(options.some((label) => label?.includes("5 Class Pack"))).toBe(true)
  })

  it("shows a loading state while plans are loading", async () => {
    const node = await render(createProps({ plansLoading: true }))
    expect(node.textContent).toContain("Loading package plans...")
    expect(node.querySelector("select")).toBeNull()
  })

  it("shows a plans error message", async () => {
    const node = await render(createProps({ plansError: "Failed to load package plans." }))
    expect(node.textContent).toContain("Failed to load package plans.")
  })

  it("disables the submit button until a plan and reason are provided", async () => {
    const node = await render(createProps())
    const submitButton = Array.from(node.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Grant cash package")
    )
    expect(submitButton?.disabled).toBe(true)

    const node2 = await render(createProps({ selectedPlanId: "plan-1", reason: "Front desk cash sale" }))
    const submitButton2 = Array.from(node2.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Grant cash package")
    )
    expect(submitButton2?.disabled).toBe(false)
  })

  it("calls onSubmit when the grant button is clicked", async () => {
    const onSubmit = vi.fn()
    const node = await render(createProps({ selectedPlanId: "plan-1", reason: "Front desk cash sale", onSubmit }))
    const submitButton = Array.from(node.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Grant cash package")
    )
    await act(async () => submitButton?.click())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("shows the duplicate warning with a confirm button that re-submits", async () => {
    const onConfirmDuplicate = vi.fn()
    const node = await render(
      createProps({
        state: "duplicate",
        duplicate: { id: "pkg-existing", label: "Unlimited Monthly", expiresAt: "2026-08-01T00:00:00.000Z" },
        onConfirmDuplicate,
      })
    )

    expect(node.textContent).toContain("already has an active package")
    expect(node.textContent).toContain("Unlimited Monthly")

    const confirmButton = Array.from(node.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Grant anyway")
    )
    expect(confirmButton).toBeTruthy()
    await act(async () => confirmButton?.click())
    expect(onConfirmDuplicate).toHaveBeenCalledTimes(1)
  })

  it("shows a success state with a start-another action", async () => {
    const onStartAnother = vi.fn()
    const node = await render(createProps({ state: "success", grantedPurchaseId: "purchase-1", onStartAnother }))

    expect(node.textContent).toContain("pending settlement")
    expect(node.textContent).toContain("purchase-1")

    const startAnotherButton = Array.from(node.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Grant another package")
    )
    await act(async () => startAnotherButton?.click())
    expect(onStartAnother).toHaveBeenCalledTimes(1)
  })

  it("shows the error message when present", async () => {
    const node = await render(createProps({ state: "error", errorMessage: "Package plan is not available for purchase." }))
    expect(node.textContent).toContain("Package plan is not available for purchase.")
  })

  it("sets the expires-at min to today's LOCAL date, not the UTC-shifted date, for a late-evening America/New_York time", async () => {
    // 11:30 PM America/New_York on 2026-07-12 is 03:30 AM UTC on 2026-07-13.
    // A UTC-based `min` (e.g. `new Date().toISOString().slice(0, 10)`) would
    // incorrectly yield "2026-07-13", rejecting the valid local "today"
    // (2026-07-12) in the date picker.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-13T03:30:00.000Z"))

    const node = await render(createProps({ selectedPlanId: "plan-1", reason: "Front desk cash sale" }))
    const dateInput = node.querySelector('input[type="date"]') as HTMLInputElement

    expect(dateInput.min).toBe("2026-07-12")

    vi.useRealTimers()
  })
})
