import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOMS_PANEL_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/StaffSchoolRoomsPanel.tsx"
)

const ROOM_MODAL_OVERLAYS_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/StaffAdminModalOverlays.tsx"
)

const SCHOOL_WORKSPACE_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/StaffSchoolWorkspacePanel.tsx"
)

const RESERVATIONS_PANEL_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/StaffRoomReservationsPanel.tsx"
)

const RESERVATION_FORM_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/StaffRoomReservationForm.tsx"
)

const RESERVATION_LIST_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/StaffRoomReservationList.tsx"
)

const FORMATTERS_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/staffAdminFormatters.ts"
)

const ROOM_HELPERS_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/staffRoomHelpers.ts"
)

const ROOMS_HOOK_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/useStaffRoomsAdmin.ts"
)

const roomsPanelSource = readFileSync(ROOMS_PANEL_SOURCE_PATH, "utf8")
const roomModalOverlaysSource = readFileSync(ROOM_MODAL_OVERLAYS_SOURCE_PATH, "utf8")
const schoolWorkspaceSource = readFileSync(SCHOOL_WORKSPACE_SOURCE_PATH, "utf8")
const reservationsPanelSource = readFileSync(RESERVATIONS_PANEL_SOURCE_PATH, "utf8")
const reservationFormSource = readFileSync(RESERVATION_FORM_SOURCE_PATH, "utf8")
const reservationListSource = readFileSync(RESERVATION_LIST_SOURCE_PATH, "utf8")
const formattersSource = readFileSync(FORMATTERS_SOURCE_PATH, "utf8")
const roomHelpersSource = readFileSync(ROOM_HELPERS_SOURCE_PATH, "utf8")
const roomsHookSource = readFileSync(ROOMS_HOOK_SOURCE_PATH, "utf8")

describe("StaffUsersAdminClient rooms lifecycle actions", () => {
  it("includes activate action for inactive rooms", () => {
    expect(roomsPanelSource).toContain('onClick={() => void actions.activateRoom(room.id)}')
    expect(roomsPanelSource).toContain('"Activate"')
  })

  it("includes safe-delete action bound to modal and safe-delete endpoint", () => {
    expect(roomsPanelSource).toContain('onClick={() => actions.openRoomSafeDeleteModal(room)}')
    expect(roomsHookSource).toContain("const [roomSafeDeleteModal, setRoomSafeDeleteModal]")
    expect(roomsHookSource).toContain("const confirmRoomSafeDelete = React.useCallback(async () => {")
    expect(roomsHookSource).toContain('`/api/staff/rooms/${room.id}/safe-delete`')
  })

  it("does not use native prompt/confirm for rooms lifecycle safe-delete", () => {
    const roomsLifecycleSection = roomsHookSource.slice(roomsHookSource.indexOf("const disableRoom = React.useCallback"))
    expect(roomsLifecycleSection).not.toContain("window.prompt")
    expect(roomsLifecycleSection).not.toContain("window.confirm")
    expect(roomModalOverlaysSource).toContain("Deletion reason (required)")
  })

  it("formats disable errors using blocker-aware resolver", () => {
    expect(roomsHookSource).toContain("resolveRoomActionErrorMessage(data, \"Unable to disable room.\")")
    expect(roomHelpersSource).toContain("formatRoomActionBlockers")
  })

  it("includes room reassignment modal wired to reassign endpoint", () => {
    expect(roomsHookSource).toContain("const [roomReassignModal, setRoomReassignModal]")
    expect(roomsHookSource).toContain("const confirmRoomReassign = React.useCallback(async () => {")
    expect(roomsHookSource).toContain('`/api/staff/rooms/${room.id}/reassign`')
    expect(roomsHookSource).toContain("courseIds: selectedCourseIds")
    expect(roomModalOverlaysSource).toContain("Also move future sessions (all-or-nothing if any conflict exists)")
    expect(roomModalOverlaysSource).toContain("Affected courses in source room")
    expect(roomsHookSource).toContain("scheduleLabel: buildAssignmentCourseScheduleLabel(course)")
    expect(roomModalOverlaysSource).toContain("Schedule not configured")
    expect(roomModalOverlaysSource).toContain("selectedCourseIds")
    expect(roomModalOverlaysSource).toContain("Confirm reassignment")
  })

  it("does not use native prompt/confirm for room reassignment", () => {
    const roomReassignSection = roomsHookSource.slice(roomsHookSource.indexOf("const openRoomReassignModal = React.useCallback"))
    expect(roomReassignSection).not.toContain("window.prompt")
    expect(roomReassignSection).not.toContain("window.confirm")
    expect(roomReassignSection).not.toContain("window.alert")
  })

  it("includes reservations panel wired to list/create/cancel endpoints", () => {
    expect(reservationsPanelSource).toContain("Private reservations")
    expect(roomsHookSource).toContain('fetch("/api/staff/room-reservations"')
    expect(roomsHookSource).toContain("const saveRoomReservation = React.useCallback(async (event: React.FormEvent) => {")
    expect(roomsHookSource).toContain('fetch("/api/staff/room-reservations", {')
    expect(roomsHookSource).toContain('`/api/staff/room-reservations/${reservation.id}/cancel`')
    expect(roomModalOverlaysSource).toContain("Confirm cancel")
    expect(reservationFormSource).toContain("Create reservation")
    expect(reservationFormSource).toContain("Reservation date range")
    expect(reservationFormSource).toContain("rangeMode={true}")
    expect(reservationFormSource).toContain("Start time")
    expect(reservationFormSource).toContain("End time")
    expect(reservationFormSource).toContain("Start: {formatReservationDateLabel(roomReservationForm.startDate)")
    expect(reservationFormSource).toContain("End: {formatReservationDateLabel(roomReservationForm.endDate || roomReservationForm.startDate)")
    expect(reservationFormSource).toContain("reservationRangePreview")
    expect(reservationFormSource).toContain("grid gap-4 md:grid-cols-2")
  })

  it("defines and uses a date-time formatter for reservation rendering", () => {
    expect(formattersSource).toContain("export const formatDateTime = (value: string | number | null | undefined) => {")
    expect(reservationsPanelSource).toContain("formatDateTime: (value: string | number | null | undefined) => string")
    expect(reservationListSource).toContain("{formatDateTime(item.startsAt)} → {formatDateTime(item.endsAt)}")
  })

  it("builds startsAt/endsAt payload from date and time fields with overnight guard", () => {
    expect(roomsHookSource).toContain("const effectiveEndDate = roomReservationForm.endDate || roomReservationForm.startDate")
    expect(roomsHookSource).toContain("const startsAtDate = buildReservationDateTime(roomReservationForm.startDate, roomReservationForm.startTime)")
    expect(roomsHookSource).toContain("const endsAtDate = buildReservationDateTime(effectiveEndDate, roomReservationForm.endTime)")
    expect(roomsHookSource).toContain("startsAt: startsAtDate.toISOString()")
    expect(roomsHookSource).toContain("endsAt: endsAtDate.toISOString()")
    expect(roomsHookSource).toContain("End date/time must be after start date/time. For overnight events, choose the next day as end date.")
    expect(schoolWorkspaceSource).toContain('"Choose start/end time and a valid date range."')
  })

  it("keeps range click flow by not forcing same-day end in onRangeChange", () => {
    expect(reservationFormSource).toContain("rangeEnd={roomReservationForm.endDate || undefined}")
    expect(roomsHookSource).toContain("endDate: endDate || \"\"")
    expect(reservationFormSource).not.toContain("endDate: end || start")
  })

  it("does not use native dialogs for reservation cancellation", () => {
    const reservationSection = roomsHookSource.slice(roomsHookSource.indexOf("const saveRoomReservation = React.useCallback"))
    expect(reservationSection).not.toContain("window.prompt")
    expect(reservationSection).not.toContain("window.confirm")
    expect(reservationSection).not.toContain("window.alert")
    expect(roomModalOverlaysSource).toContain("Cancellation reason (optional)")
  })
})
