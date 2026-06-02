// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffSchoolPackagesPointsPanel from "@/components/front/staff/StaffSchoolPackagesPointsPanel"
import type { SchoolPackageRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffSchoolPackagesPointsPanel>

const packageRow: SchoolPackageRow = {
  id: "pkg-1",
  key: "starter-pack",
  courseSlug: "salsa",
  courseSlugs: ["salsa"],
  label: "Starter Pack",
  description: null,
  priceCents: 12000,
  cadence: null,
  status: "ACTIVE",
  launchAt: null,
  totalCredits: 4,
  makeUps: 1,
  validDays: 30,
  isUnlimited: false,
  active: true,
  createdAt: "2026-05-01T00:00:00.000Z",
}

const createProps = (overrides: Partial<Props> = {}): Props => ({
  wizard: {
    activeEntity: "packages",
    step: 1,
    totalSteps: 4,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  },
  schoolLoading: false,
  schoolBusy: null,
  currentRole: "owner",
  packages: {
    form: {
      id: "",
      key: "starter-pack",
      courseSlugs: [],
      label: "Starter Pack",
      description: "",
      priceCents: "120",
      cadence: "",
      status: "ACTIVE",
      launchAt: "",
      totalCredits: "4",
      makeUps: "1",
      validDays: "30",
      isUnlimited: false,
      active: true,
    },
    setForm: vi.fn(),
    editingPackageId: null,
    setEditingPackageId: vi.fn(),
    courseOptions: [{ slug: "salsa", title: "Salsa", description: "Basics", imageUrl: null, scheduleLabel: "Mon 7pm", kindLabel: "Course" }],
    togglePackageCourse: vi.fn(),
    onSave: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    statusFilter: "all",
    setStatusFilter: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    counts: { all: 1, live: 1, ACTIVE: 1, SUSPENDED: 0, SCHEDULED: 0, DELETED: 0 },
    filteredItems: [packageRow],
    setLifecycleState: vi.fn().mockResolvedValue(undefined),
    deletePackagePlan: vi.fn().mockResolvedValue(undefined),
    formatMoney: (amount) => `$${(amount / 100).toFixed(2)}`,
  },
  points: {
    ruleForm: { templateKey: "profile-completed", points: "1", active: true },
    setRuleForm: vi.fn(),
    selectedTemplate: { key: "profile-completed", label: "Attendance", description: "Attend class", eventType: "attendance", defaultPoints: 1 },
    onSaveRule: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    resetRuleForm: vi.fn(),
    assignForm: { userEmail: "student@example.com", type: "manual", points: "2", note: "", eventKey: "" },
    setAssignForm: vi.fn(),
    onAssign: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    resetAssignForm: vi.fn(),
    rules: [{ id: "rule-1", key: "attendance", label: "Attendance", description: null, eventType: "attendance", points: 1, active: true, createdAt: "2026-05-01" }],
  },
  ...overrides,
})

describe("StaffSchoolPackagesPointsPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderPanel(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffSchoolPackagesPointsPanel {...props} />))
    return container
  }

  it("renders package builder, catalog, and course toggle", async () => {
    const togglePackageCourse = vi.fn()
    const props = createProps({ packages: { ...createProps().packages, togglePackageCourse } })
    const node = await renderPanel(props)
    const courseButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent?.includes("Salsa"))

    expect(node.textContent).toContain("Package builder")
    expect(node.textContent).toContain("Starter Pack")
    await act(async () => courseButton?.click())
    expect(togglePackageCourse).toHaveBeenCalledWith("salsa")
  })

  it("renders points rule builder and saved rules", async () => {
    const node = await renderPanel(createProps({ wizard: { ...createProps().wizard, activeEntity: "points", step: 0, totalSteps: 2 } }))

    expect(node.textContent).toContain("Points builder")
    expect(node.textContent).toContain("Rule builder")
    expect(node.textContent).toContain("Saved rules")
    expect(node.textContent).toContain("Attendance")
  })

  it("renders nothing outside packages and points", async () => {
    const node = await renderPanel(createProps({ wizard: { ...createProps().wizard, activeEntity: "courses" } }))

    expect(node.textContent).not.toContain("Package builder")
    expect(node.textContent).not.toContain("Points builder")
  })
})
