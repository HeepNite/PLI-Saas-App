// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffSchoolRoomsPanel from "@/components/front/staff/StaffSchoolRoomsPanel"
import type { RoomRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffSchoolRoomsPanel>

const room: RoomRow = { id: "room-1", name: "Main Room", capacity: 18, location: "Front", active: true }
const inactiveRoom: RoomRow = { id: "room-2", name: "Back Room", capacity: 10, location: null, active: false }

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  wizard: {
    step: 0,
    totalSteps: 2,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  },
  form: {
    roomForm: { id: "", name: "Main Room", capacity: "18", location: "Front", active: true },
    updateRoomFormField: vi.fn(),
    onSaveRoom: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    resetRoomForm: vi.fn(),
    roomSaving: false,
    roomFormError: null,
    roomFormSuccess: null,
  },
  filters: {
    roomSearchQuery: "",
    setRoomSearchQuery: vi.fn(),
    roomStatusFilter: "all",
    setRoomStatusFilter: vi.fn(),
  },
  data: {
    schoolLoading: false,
    visibleRooms: [room, inactiveRoom],
    activeRoomOptions: [room],
    roomBusyId: null,
    roomActionErrors: { "room-2": "Cannot delete while linked" },
  },
  actions: {
    loadRoomIntoForm: vi.fn(),
    activateRoom: vi.fn().mockResolvedValue(undefined),
    disableRoom: vi.fn().mockResolvedValue(undefined),
    openRoomReassignModal: vi.fn(),
    openRoomSafeDeleteModal: vi.fn(),
    resolveRoomDisableActionState: vi.fn((targetRoom: RoomRow, busyId: string | null) => ({
      disabled: busyId === targetRoom.id,
      label: targetRoom.active ? "Disable" : "Already inactive",
    })),
  },
  ...overrides,
})

describe("StaffSchoolRoomsPanel", () => {
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
    await act(async () => root!.render(<StaffSchoolRoomsPanel {...props} />))
    return container
  }

  it("renders nothing when hidden", async () => {
    const node = await renderPanel(createProps({ visible: false }))

    expect(node.textContent).not.toContain("Room management")
  })

  it("renders room form and list", async () => {
    const node = await renderPanel(createProps())

    expect(node.textContent).toContain("Room management")
    expect(node.querySelector<HTMLInputElement>('input[name="roomName"]')?.value).toBe("Main Room")
    expect(node.textContent).toContain("Capacity 18 · Front")
    expect(node.textContent).toContain("Cannot delete while linked")
  })

  it("wires form, filter, and room actions", async () => {
    const props = createProps()
    const node = await renderPanel(props)
    const form = node.querySelector<HTMLFormElement>("form")
    const searchInput = node.querySelector<HTMLInputElement>('input[placeholder="Search by room or location"]')
    const editButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Edit")
    const disableButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Disable")
    const activateButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Activate")

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(searchInput, "front")
      searchInput?.dispatchEvent(new Event("input", { bubbles: true }))
      editButton?.click()
      disableButton?.click()
      activateButton?.click()
    })

    expect(props.form.onSaveRoom).toHaveBeenCalledTimes(1)
    expect(props.filters.setRoomSearchQuery).toHaveBeenCalledWith("front")
    expect(props.actions.loadRoomIntoForm).toHaveBeenCalledWith(room)
    expect(props.actions.disableRoom).toHaveBeenCalledWith("room-1")
    expect(props.actions.activateRoom).toHaveBeenCalledWith("room-2")
  })
})
