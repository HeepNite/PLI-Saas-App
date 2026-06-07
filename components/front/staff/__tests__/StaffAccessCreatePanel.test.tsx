// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffAccessCreatePanel from "@/components/front/staff/StaffAccessCreatePanel"
import type { StaffCategory } from "@/lib/security/staff-category"
import type { StaffRole } from "@/lib/security/staff-role"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type StaffAccessCreatePanelProps = React.ComponentProps<typeof StaffAccessCreatePanel>

const createProps = (overrides: Partial<StaffAccessCreatePanelProps> = {}): StaffAccessCreatePanelProps => ({
  showStaffOps: true,
  form: {
    email: "staff@example.com",
    setEmail: vi.fn(),
    firstName: "Jane",
    setFirstName: vi.fn(),
    lastName: "Doe",
    setLastName: vi.fn(),
    newRole: "staff",
    setNewRole: vi.fn(),
    newCategory: "guest",
    setNewCategory: vi.fn(),
    newPin: "",
    setNewPin: vi.fn(),
  },
  assignableRoles: ["staff", "admin"],
  status: {
    createBusy: false,
    createMessage: null,
    error: null,
  },
  onSubmit: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
  ...overrides,
})

describe("StaffAccessCreatePanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderPanel(props: StaffAccessCreatePanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffAccessCreatePanel {...props} />)
    })
    return container
  }

  it("renders nothing when staff ops are hidden", async () => {
    const node = await renderPanel(createProps({ showStaffOps: false }))

    expect(node.textContent).not.toContain("Invite or promote user")
  })

  it("renders form fields and role options", async () => {
    const node = await renderPanel(createProps())
    const roleSelect = node.querySelector<HTMLSelectElement>('select[name="staffRole"]')

    expect(node.textContent).toContain("Staff access")
    expect(node.querySelector<HTMLInputElement>('input[name="staffEmail"]')?.value).toBe("staff@example.com")
    expect(node.querySelector<HTMLInputElement>('input[name="staffFirstName"]')?.value).toBe("Jane")
    expect(roleSelect?.textContent).toContain("Staff")
    expect(roleSelect?.textContent).toContain("Admin")
  })

  it("normalizes category when role changes", async () => {
    const setNewRole = vi.fn()
    const setNewCategory = vi.fn((updater: React.SetStateAction<StaffCategory>) => {
      if (typeof updater === "function") {
        return updater("teacher")
      }
      return updater
    })
    const node = await renderPanel(createProps({
      form: {
        ...createProps().form,
        setNewRole,
        setNewCategory,
      },
    }))
    const roleSelect = node.querySelector<HTMLSelectElement>('select[name="staffRole"]')

    await act(async () => {
      roleSelect!.value = "admin" satisfies StaffRole
      roleSelect!.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(setNewRole).toHaveBeenCalledWith("admin")
    expect(setNewCategory).toHaveBeenCalledTimes(1)
    expect(setNewCategory.mock.results[0]?.value).toBe("manager")
  })

  it("strips non-digits and caps PIN input at four digits", async () => {
    const setNewPin = vi.fn()
    const node = await renderPanel(createProps({ form: { ...createProps().form, setNewPin } }))
    const pinInput = node.querySelector<HTMLInputElement>('input[name="staffPin"]')

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(pinInput, "a12b345")
      pinInput!.dispatchEvent(new Event("input", { bubbles: true }))
    })

    expect(setNewPin).toHaveBeenCalledWith("1234")
  })

  it("calls submit handler", async () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault())
    const node = await renderPanel(createProps({ onSubmit }))
    const form = node.querySelector<HTMLFormElement>("form")

    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("renders busy, success, and error states", async () => {
    const node = await renderPanel(createProps({
      status: {
        createBusy: true,
        createMessage: "Invitation sent",
        error: "Create failed",
      },
    }))

    expect(node.textContent).toContain("Processing...")
    expect(node.textContent).toContain("Invitation sent")
    expect(node.textContent).toContain("Create failed")
  })

  it("locks category select for fixed role categories", async () => {
    const node = await renderPanel(createProps({
      form: {
        ...createProps().form,
        newRole: "admin",
        newCategory: "manager",
      },
    }))
    const categorySelect = node.querySelector<HTMLSelectElement>('select[name="staffCategory"]')

    expect(categorySelect?.disabled).toBe(true)
    expect(categorySelect?.textContent).toContain("Managers")
  })
})
