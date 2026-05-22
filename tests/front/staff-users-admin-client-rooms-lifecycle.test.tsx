import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/StaffUsersAdminClient.tsx"
)

const RESERVATION_FORM_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/StaffRoomReservationForm.tsx"
)

const RESERVATION_LIST_SOURCE_PATH = join(
  process.cwd(),
  "components/front/staff/StaffRoomReservationList.tsx"
)

const source = readFileSync(SOURCE_PATH, "utf8")
const reservationFormSource = readFileSync(RESERVATION_FORM_SOURCE_PATH, "utf8")
const reservationListSource = readFileSync(RESERVATION_LIST_SOURCE_PATH, "utf8")

describe("StaffUsersAdminClient rooms lifecycle actions", () => {
  it("includes activate action for inactive rooms", () => {
    expect(source).toContain('onClick={() => void activateRoom(room.id)}')
    expect(source).toContain('"Activate"')
  })

  it("includes safe-delete action bound to modal and safe-delete endpoint", () => {
    expect(source).toContain('onClick={() => openRoomSafeDeleteModal(room)}')
    expect(source).toContain("const [roomSafeDeleteModal, setRoomSafeDeleteModal]")
    expect(source).toContain("const confirmRoomSafeDelete = React.useCallback(async () => {")
    expect(source).toContain('`/api/staff/rooms/${room.id}/safe-delete`')
  })

  it("does not use native prompt/confirm for rooms lifecycle safe-delete", () => {
    const roomsLifecycleSection = source.slice(source.indexOf("const disableRoom = React.useCallback"), source.indexOf("const resetCourseBuilder = React.useCallback"))
    expect(roomsLifecycleSection).not.toContain("window.prompt")
    expect(roomsLifecycleSection).not.toContain("window.confirm")
    expect(source).toContain("Deletion reason (required)")
  })

  it("formats disable errors using blocker-aware resolver", () => {
    expect(source).toContain("resolveRoomActionErrorMessage(data, \"Unable to disable room.\")")
    expect(source).toContain("formatRoomActionBlockers")
  })

  it("includes room reassignment modal wired to reassign endpoint", () => {
    expect(source).toContain("const [roomReassignModal, setRoomReassignModal]")
    expect(source).toContain("const confirmRoomReassign = React.useCallback(async () => {")
    expect(source).toContain('`/api/staff/rooms/${room.id}/reassign`')
    expect(source).toContain("courseIds: selectedCourseIds")
    expect(source).toContain("Also move future sessions (all-or-nothing if any conflict exists)")
    expect(source).toContain("Affected courses in source room")
    expect(source).toContain("scheduleLabel: buildAssignmentCourseScheduleLabel(course)")
    expect(source).toContain("Schedule not configured")
    expect(source).toContain("selectedCourseIds")
    expect(source).toContain("Confirm reassignment")
  })

  it("does not use native prompt/confirm for room reassignment", () => {
    const roomReassignSection = source.slice(source.indexOf("const openRoomReassignModal = React.useCallback"), source.indexOf("const resetCourseBuilder = React.useCallback"))
    expect(roomReassignSection).not.toContain("window.prompt")
    expect(roomReassignSection).not.toContain("window.confirm")
    expect(roomReassignSection).not.toContain("window.alert")
  })

  it("includes reservations panel wired to list/create/cancel endpoints", () => {
    expect(source).toContain("Private reservations")
    expect(source).toContain('fetch("/api/staff/room-reservations"')
    expect(source).toContain("const saveRoomReservation = React.useCallback(async (event: React.FormEvent) => {")
    expect(source).toContain('fetch("/api/staff/room-reservations", {')
    expect(source).toContain('`/api/staff/room-reservations/${reservation.id}/cancel`')
    expect(source).toContain("Confirm cancel")
    expect(reservationFormSource).toContain("Create reservation")
    expect(reservationFormSource).toContain("Reservation date range")
    expect(reservationFormSource).toContain("rangeMode={true}")
    expect(reservationFormSource).toContain("Start time")
    expect(reservationFormSource).toContain("End time")
    expect(reservationFormSource).toContain("Start: {formatReservationDateLabel(roomReservationForm.startDate)")
    expect(reservationFormSource).toContain("End: {formatReservationDateLabel(roomReservationForm.endDate || roomReservationForm.startDate)")
    expect(source).toContain("reservationRangePreview")
    expect(reservationFormSource).toContain("grid gap-4 md:grid-cols-2")
  })

  it("defines and uses a date-time formatter for reservation rendering", () => {
    expect(source).toContain("const formatDateTime = (value: string | number | null | undefined) => {")
    expect(reservationListSource).toContain("{formatDateTime(item.startsAt)} → {formatDateTime(item.endsAt)}")
  })

  it("builds startsAt/endsAt payload from date and time fields with overnight guard", () => {
    expect(source).toContain("const effectiveEndDate = roomReservationForm.endDate || roomReservationForm.startDate")
    expect(source).toContain("const startsAtDate = buildReservationDateTime(roomReservationForm.startDate, roomReservationForm.startTime)")
    expect(source).toContain("const endsAtDate = buildReservationDateTime(effectiveEndDate, roomReservationForm.endTime)")
    expect(source).toContain("startsAt: startsAtDate.toISOString()")
    expect(source).toContain("endsAt: endsAtDate.toISOString()")
    expect(source).toContain("End date/time must be after start date/time. For overnight events, choose the next day as end date.")
    expect(source).toContain('"Choose start/end time and a valid date range."')
  })

  it("keeps range click flow by not forcing same-day end in onRangeChange", () => {
    expect(source).toContain("rangeEnd={roomReservationForm.endDate || undefined}")
    expect(source).toContain("endDate: end || \"\"")
    expect(source).not.toContain("endDate: end || start")
  })

  it("does not use native dialogs for reservation cancellation", () => {
    const reservationSection = source.slice(source.indexOf("const saveRoomReservation = React.useCallback"), source.indexOf("const resetCourseBuilder = React.useCallback"))
    expect(reservationSection).not.toContain("window.prompt")
    expect(reservationSection).not.toContain("window.confirm")
    expect(reservationSection).not.toContain("window.alert")
    expect(source).toContain("Cancellation reason (optional)")
  })
})
