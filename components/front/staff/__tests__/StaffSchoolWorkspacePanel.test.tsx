// @vitest-environment jsdom

import React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { SchoolWizardState, StepEnabledContext } from "@/components/front/staff/school"
import StaffSchoolWorkspacePanel from "@/components/front/staff/StaffSchoolWorkspacePanel"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/components/front/staff/school", async () => {
  const actual = await vi.importActual<typeof import("@/components/front/staff/school")>("@/components/front/staff/school")
  return {
    ...actual,
    SchoolWizardPanel: ({ onSave }: { onSave?: () => void }) => (
      <div data-testid="wizard-panel">
        <button type="button" disabled={!onSave} onClick={onSave}>Save wizard</button>
      </div>
    ),
  }
})

vi.mock("@/components/front/staff/StaffCatalogSection", () => ({
  default: ({ children, fetchSchoolData }: { children: React.ReactNode; fetchSchoolData: () => void }) => (
    <section data-testid="catalog-section">
      <button type="button" onClick={fetchSchoolData}>Refresh school data</button>
      {children}
    </section>
  ),
}))

vi.mock("@/components/front/staff/StaffRoomReservationsPanel", () => ({
  default: ({ visible }: { visible: boolean }) => visible ? <div data-testid="reservations-panel" /> : null,
}))

vi.mock("@/components/front/staff/StaffSchoolRoomsPanel", () => ({
  default: ({ visible }: { visible: boolean }) => visible ? <div data-testid="rooms-panel" /> : null,
}))

vi.mock("@/components/front/staff/StaffCourseStudioPanel", () => ({
  default: ({ wizard }: { wizard: { activeEntity: string } }) => wizard.activeEntity === "courses" ? <div data-testid="course-studio-panel" /> : null,
}))

vi.mock("@/components/front/staff/StaffCourseCatalogPanel", () => ({
  default: ({ visible }: { visible: boolean }) => visible ? <div data-testid="course-catalog-panel" /> : null,
}))

vi.mock("@/components/front/staff/StaffSchoolPackagesPointsPanel", () => ({
  default: () => <div data-testid="packages-points-panel" />,
}))

const enabledContext: StepEnabledContext = { courseEditingSlug: "course-1" }

const wizard = (overrides: Partial<SchoolWizardState> = {}): SchoolWizardState => ({
  activeEntity: "courses",
  step: 6,
  setStep: vi.fn(),
  goToEntity: vi.fn(),
  nextStep: vi.fn(),
  prevStep: vi.fn(),
  totalSteps: 7,
  ...overrides,
})

const baseProps = (overrides: Partial<React.ComponentProps<typeof StaffSchoolWorkspacePanel>> = {}): React.ComponentProps<typeof StaffSchoolWorkspacePanel> => ({
  isSchoolView: true,
  wizard: wizard(),
  wizardEnabledContext: enabledContext,
  catalog: {
    schoolLoading: false,
    fetchSchoolData: vi.fn(),
    schoolCoursesCount: 1,
    activeSchoolCoursesCount: 1,
    schoolRoomsCount: 1,
    activeRoomOptionsCount: 1,
    packageCounts: { all: 0, ACTIVE: 0, SUSPENDED: 0 },
    schoolPointsRulesCount: 0,
    activeSchoolPointsRulesCount: 0,
    courseLinkStats: { total: 0, active: 0, inactive: 0 },
  },
  status: { schoolBusy: null, schoolError: null, schoolSuccess: null },
  requestWizardSave: vi.fn(),
  reservations: { visible: false } as React.ComponentProps<typeof StaffSchoolWorkspacePanel>["reservations"],
  rooms: { visible: false } as React.ComponentProps<typeof StaffSchoolWorkspacePanel>["rooms"],
  courseStudio: { wizard: { activeEntity: "courses" } } as React.ComponentProps<typeof StaffSchoolWorkspacePanel>["courseStudio"],
  courseCatalog: { visible: true } as React.ComponentProps<typeof StaffSchoolWorkspacePanel>["courseCatalog"],
  packagesPoints: {} as React.ComponentProps<typeof StaffSchoolWorkspacePanel>["packagesPoints"],
  ...overrides,
})

describe("StaffSchoolWorkspacePanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderPanel(props: React.ComponentProps<typeof StaffSchoolWorkspacePanel>) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffSchoolWorkspacePanel {...props} />))
    return container
  }

  async function rerenderPanel(props: React.ComponentProps<typeof StaffSchoolWorkspacePanel>) {
    await act(async () => root!.render(<StaffSchoolWorkspacePanel {...props} />))
    return container!
  }

  it("returns null when school view is hidden", async () => {
    await renderPanel(baseProps({ isSchoolView: false }))

    expect(container?.textContent).toBe("")
  })

  it("renders the school workspace composition when visible", async () => {
    const rendered = await renderPanel(baseProps())

    expect(rendered.querySelector("[data-testid='catalog-section']")).not.toBeNull()
    expect(rendered.querySelector("[data-testid='wizard-panel']")).not.toBeNull()
    expect(rendered.querySelector("[data-testid='course-studio-panel']")).not.toBeNull()
    expect(rendered.querySelector("[data-testid='course-catalog-panel']")).not.toBeNull()
    expect(rendered.querySelector("[data-testid='packages-points-panel']")).not.toBeNull()
  })

  it("enables wizard save only on saveable final steps", async () => {
    const requestWizardSave = vi.fn()
    const rendered = await renderPanel(baseProps({ requestWizardSave }))
    const saveButton = () =>
      [...rendered.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Save wizard")!

    await act(async () => {
      saveButton().click()
    })
    expect(requestWizardSave).toHaveBeenCalledTimes(1)

    await rerenderPanel(baseProps({ requestWizardSave, wizard: wizard({ activeEntity: "courses", step: 2 }) }))
    expect(saveButton().disabled).toBe(true)
  })
})
