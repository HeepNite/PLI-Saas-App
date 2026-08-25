import React from "react"

import {
  buildCourseRoomOptions,
  buildRoomLookup,
  filterVisibleRooms,
  resolveRoomDisableActionState,
} from "./staffRoomCatalogHelpers"
import {
  createEmptyRoomReservationForm,
  createInitialRoomForm,
  createRoomFormFromRoom,
  type RoomFormState,
  type RoomReservationFormState,
} from "./staffRoomFormState"
import { formatReservationDateLabel, normalizeClockTime } from "./staffAdminFormatters"
import { ISO_DATE_REGEX } from "./staffAdminConstants"
import { buildAssignmentCourseScheduleLabel } from "./staffCourseScheduleHelpers"
import { resolveRoomActionErrorMessage } from "./staffRoomHelpers"
import type {
  RoomReservationCancelModalState,
  RoomReservationRow,
  RoomRow,
  RoomSafeDeleteModalState,
  RoomReassignModalState,
  SchoolCourseRow,
  StaffUserRow,
} from "./staffAdminTypes"

type FetchSchoolData = (options?: { showLoader?: boolean }) => Promise<void>

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const buildReservationDateTime = (date: string, time: string) => {
  if (!ISO_DATE_REGEX.test(date) || !normalizeClockTime(time)) return null
  const parsed = new Date(`${date}T${time}:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const clearRecordEntry = <TValue,>(record: Record<string, TValue>, key: string) => {
  if (!record[key]) return record
  const next = { ...record }
  delete next[key]
  return next
}

const buildReservationRangePreview = (form: RoomReservationFormState) => {
  const effectiveEndDate = form.endDate || form.startDate
  const startsAt = buildReservationDateTime(form.startDate, form.startTime)
  const endsAt = buildReservationDateTime(effectiveEndDate, form.endTime)
  if (!startsAt || !endsAt) return ""
  if (endsAt.getTime() <= startsAt.getTime()) return ""
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }
  return `${startsAt.toLocaleString("en-US", options)} → ${endsAt.toLocaleString("en-US", options)}`
}

// ---------------------------------------------------------------------------
// Room reducer
// ---------------------------------------------------------------------------

interface RoomState {
  roomForm: RoomFormState
  roomSearchQuery: string
  roomStatusFilter: "all" | "active" | "inactive"
  roomSaving: boolean
  roomBusyId: string | null
  roomFormError: string | null
  roomFormSuccess: string | null
  roomActionErrors: Record<string, string>
  roomSafeDeleteModal: RoomSafeDeleteModalState | null
  roomReassignModal: RoomReassignModalState | null
}

type RoomAction =
  | { type: "SET_ROOM_FORM"; payload: RoomFormState }
  | { type: "PATCH_ROOM_FORM"; field: keyof RoomFormState; value: RoomFormState[keyof RoomFormState] }
  | { type: "SET_ROOM_SEARCH_QUERY"; payload: string }
  | { type: "SET_ROOM_STATUS_FILTER"; payload: "all" | "active" | "inactive" }
  | { type: "SET_ROOM_SAVING"; payload: boolean }
  | { type: "SET_ROOM_BUSY_ID"; payload: string | null }
  | { type: "SET_ROOM_FORM_ERROR"; payload: string | null }
  | { type: "SET_ROOM_FORM_SUCCESS"; payload: string | null }
  | { type: "SET_ROOM_ACTION_ERROR"; roomId: string; error: string }
  | { type: "CLEAR_ROOM_ACTION_ERROR"; roomId: string }
  | { type: "SET_ROOM_SAFE_DELETE_MODAL"; payload: RoomSafeDeleteModalState | null }
  | { type: "PATCH_ROOM_SAFE_DELETE_MODAL"; patch: Partial<RoomSafeDeleteModalState> }
  | { type: "SET_ROOM_REASSIGN_MODAL"; payload: RoomReassignModalState | null }
  | { type: "PATCH_ROOM_REASSIGN_MODAL"; patch: Partial<RoomReassignModalState> }
  | { type: "SET_ROOM_ACTION_BUSY"; roomId: string }

const initialRoomState: RoomState = {
  roomForm: createInitialRoomForm(),
  roomSearchQuery: "",
  roomStatusFilter: "all",
  roomSaving: false,
  roomBusyId: null,
  roomFormError: null,
  roomFormSuccess: null,
  roomActionErrors: {},
  roomSafeDeleteModal: null,
  roomReassignModal: null,
}

function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "SET_ROOM_FORM":
      return { ...state, roomForm: action.payload }
    case "PATCH_ROOM_FORM":
      return { ...state, roomForm: { ...state.roomForm, [action.field]: action.value } }
    case "SET_ROOM_SEARCH_QUERY":
      return { ...state, roomSearchQuery: action.payload }
    case "SET_ROOM_STATUS_FILTER":
      return { ...state, roomStatusFilter: action.payload }
    case "SET_ROOM_SAVING":
      return { ...state, roomSaving: action.payload }
    case "SET_ROOM_BUSY_ID":
      return { ...state, roomBusyId: action.payload }
    case "SET_ROOM_FORM_ERROR":
      return { ...state, roomFormError: action.payload }
    case "SET_ROOM_FORM_SUCCESS":
      return { ...state, roomFormSuccess: action.payload }
    case "SET_ROOM_ACTION_ERROR":
      return { ...state, roomActionErrors: { ...state.roomActionErrors, [action.roomId]: action.error } }
    case "CLEAR_ROOM_ACTION_ERROR":
      return { ...state, roomActionErrors: clearRecordEntry(state.roomActionErrors, action.roomId) }
    case "SET_ROOM_SAFE_DELETE_MODAL":
      return { ...state, roomSafeDeleteModal: action.payload }
    case "PATCH_ROOM_SAFE_DELETE_MODAL":
      return state.roomSafeDeleteModal
        ? { ...state, roomSafeDeleteModal: { ...state.roomSafeDeleteModal, ...action.patch } }
        : state
    case "SET_ROOM_REASSIGN_MODAL":
      return { ...state, roomReassignModal: action.payload }
    case "PATCH_ROOM_REASSIGN_MODAL":
      return state.roomReassignModal
        ? { ...state, roomReassignModal: { ...state.roomReassignModal, ...action.patch } }
        : state
    case "SET_ROOM_ACTION_BUSY":
      return {
        ...state,
        roomBusyId: action.roomId,
        roomActionErrors: clearRecordEntry(state.roomActionErrors, action.roomId),
        roomFormSuccess: null,
      }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Reservation reducer
// ---------------------------------------------------------------------------

interface ReservationState {
  roomReservationForm: RoomReservationFormState
  roomReservationSaving: boolean
  roomReservationCancelModal: RoomReservationCancelModalState | null
  roomReservationBusyId: string | null
  roomReservationFormError: string | null
  roomReservationFormSuccess: string | null
}

type ReservationAction =
  | { type: "SET_RESERVATION_FORM"; payload: RoomReservationFormState }
  | { type: "PATCH_RESERVATION_FORM"; field: keyof RoomReservationFormState; value: RoomReservationFormState[keyof RoomReservationFormState] }
  | { type: "PATCH_RESERVATION_DATE_RANGE"; startDate: string; endDate: string }
  | { type: "SET_RESERVATION_SAVING"; payload: boolean }
  | { type: "SET_RESERVATION_CANCEL_MODAL"; payload: RoomReservationCancelModalState | null }
  | { type: "PATCH_RESERVATION_CANCEL_MODAL"; patch: Partial<RoomReservationCancelModalState> }
  | { type: "SET_RESERVATION_BUSY_ID"; payload: string | null }
  | { type: "SET_RESERVATION_FORM_ERROR"; payload: string | null }
  | { type: "SET_RESERVATION_FORM_SUCCESS"; payload: string | null }

const initialReservationState: ReservationState = {
  roomReservationForm: createEmptyRoomReservationForm(),
  roomReservationSaving: false,
  roomReservationCancelModal: null,
  roomReservationBusyId: null,
  roomReservationFormError: null,
  roomReservationFormSuccess: null,
}

function reservationReducer(state: ReservationState, action: ReservationAction): ReservationState {
  switch (action.type) {
    case "SET_RESERVATION_FORM":
      return { ...state, roomReservationForm: action.payload }
    case "PATCH_RESERVATION_FORM":
      return { ...state, roomReservationForm: { ...state.roomReservationForm, [action.field]: action.value } }
    case "PATCH_RESERVATION_DATE_RANGE":
      return { ...state, roomReservationForm: { ...state.roomReservationForm, startDate: action.startDate, endDate: action.endDate } }
    case "SET_RESERVATION_SAVING":
      return { ...state, roomReservationSaving: action.payload }
    case "SET_RESERVATION_CANCEL_MODAL":
      return { ...state, roomReservationCancelModal: action.payload }
    case "PATCH_RESERVATION_CANCEL_MODAL":
      return state.roomReservationCancelModal
        ? { ...state, roomReservationCancelModal: { ...state.roomReservationCancelModal, ...action.patch } }
        : state
    case "SET_RESERVATION_BUSY_ID":
      return { ...state, roomReservationBusyId: action.payload }
    case "SET_RESERVATION_FORM_ERROR":
      return { ...state, roomReservationFormError: action.payload }
    case "SET_RESERVATION_FORM_SUCCESS":
      return { ...state, roomReservationFormSuccess: action.payload }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useStaffRoomsAdmin = (input: {
  rooms: RoomRow[]
  reservations: RoomReservationRow[]
  courses: SchoolCourseRow[]
  staffRows: StaffUserRow[]
  selectedCourseDefaultRoomId: string
  fetchSchoolData: FetchSchoolData
  handleStaffAuthFailure: (status: number) => boolean
}) => {
  const [roomState, dispatchRoom] = React.useReducer(roomReducer, initialRoomState)
  const [reservationState, dispatchReservation] = React.useReducer(reservationReducer, initialReservationState)

  // Destructure for ergonomic use inside callbacks
  const {
    roomForm,
    roomSearchQuery,
    roomStatusFilter,
    roomSaving,
    roomBusyId,
    roomFormError,
    roomFormSuccess,
    roomActionErrors,
    roomSafeDeleteModal,
    roomReassignModal,
  } = roomState

  const {
    roomReservationForm,
    roomReservationSaving,
    roomReservationCancelModal,
    roomReservationBusyId,
    roomReservationFormError,
    roomReservationFormSuccess,
  } = reservationState

  // ---------------------------------------------------------------------------
  // Derived values (useMemo) — unchanged
  // ---------------------------------------------------------------------------

  const roomById = React.useMemo(() => buildRoomLookup(input.rooms), [input.rooms])
  const activeRoomOptions = React.useMemo(() => input.rooms.filter((room) => room.active), [input.rooms])
  const courseRoomOptions = React.useMemo(
    () => buildCourseRoomOptions(input.rooms, input.selectedCourseDefaultRoomId),
    [input.rooms, input.selectedCourseDefaultRoomId]
  )
  const visibleRooms = React.useMemo(
    () => filterVisibleRooms(input.rooms, roomSearchQuery, roomStatusFilter),
    [input.rooms, roomSearchQuery, roomStatusFilter]
  )
  const currentUpcomingReservations = React.useMemo(() => {
    const now = Date.now()
    return input.reservations
      .filter((item) => {
        const endsAtTime = new Date(item.endsAt).getTime()
        return Number.isFinite(endsAtTime) && endsAtTime >= now
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [input.reservations])
  const reservationAssignableStaff = React.useMemo(
    () =>
      input.staffRows
        .map((item) => ({ id: item.id, label: `${item.firstName} ${item.lastName}`.trim() || item.email }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [input.staffRows]
  )
  const reservationStaffLabelById = React.useMemo(
    () =>
      reservationAssignableStaff.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.label
        return acc
      }, {}),
    [reservationAssignableStaff]
  )
  const reservationRangePreview = React.useMemo(() => buildReservationRangePreview(roomReservationForm), [roomReservationForm])

  // ---------------------------------------------------------------------------
  // Room form callbacks
  // ---------------------------------------------------------------------------

  const resetRoomForm = React.useCallback(() => {
    dispatchRoom({ type: "SET_ROOM_FORM", payload: createInitialRoomForm() })
    dispatchRoom({ type: "SET_ROOM_FORM_ERROR", payload: null })
    dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: null })
  }, [])

  const updateRoomFormField = React.useCallback(<Field extends keyof RoomFormState>(field: Field, value: RoomFormState[Field]) => {
    dispatchRoom({ type: "PATCH_ROOM_FORM", field, value })
  }, [])

  const loadRoomIntoForm = React.useCallback((room: RoomRow) => {
    dispatchRoom({ type: "SET_ROOM_FORM", payload: createRoomFormFromRoom(room) })
    dispatchRoom({ type: "SET_ROOM_FORM_ERROR", payload: null })
    dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: null })
  }, [])

  // ---------------------------------------------------------------------------
  // Reservation form callbacks
  // ---------------------------------------------------------------------------

  const updateRoomReservationFormField = React.useCallback(
    <Field extends keyof RoomReservationFormState>(field: Field, value: RoomReservationFormState[Field]) => {
      dispatchReservation({ type: "PATCH_RESERVATION_FORM", field, value })
    },
    []
  )

  const updateRoomReservationDateRange = React.useCallback((startDate: string, endDate: string | null) => {
    dispatchReservation({ type: "PATCH_RESERVATION_DATE_RANGE", startDate, endDate: endDate || "" })
  }, [])

  // ---------------------------------------------------------------------------
  // Room async actions
  // ---------------------------------------------------------------------------

  const saveRoom = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    dispatchRoom({ type: "SET_ROOM_SAVING", payload: true })
    dispatchRoom({ type: "SET_ROOM_FORM_ERROR", payload: null })
    dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: null })
    try {
      const isEditing = Boolean(roomForm.id)
      const res = await fetch(isEditing ? `/api/staff/rooms/${roomForm.id}` : "/api/staff/rooms", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomForm.name,
          capacity: roomForm.capacity,
          location: roomForm.location,
          active: roomForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (input.handleStaffAuthFailure(res.status)) return
        dispatchRoom({ type: "SET_ROOM_FORM_ERROR", payload: typeof data?.error === "string" ? data.error : "Unable to save room." })
        return
      }
      const nextSuccess = typeof data?.message === "string" ? data.message : isEditing ? "Room updated." : "Room created."
      await input.fetchSchoolData({ showLoader: false })
      resetRoomForm()
      dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: nextSuccess })
    } catch {
      dispatchRoom({ type: "SET_ROOM_FORM_ERROR", payload: "Network error while saving room." })
    } finally {
      dispatchRoom({ type: "SET_ROOM_SAVING", payload: false })
    }
  }, [input, resetRoomForm, roomForm])

  const setRoomActionBusy = React.useCallback((roomId: string) => {
    dispatchRoom({ type: "SET_ROOM_ACTION_BUSY", roomId })
  }, [])

  const disableRoom = React.useCallback(async (roomId: string) => {
    setRoomActionBusy(roomId)
    try {
      const res = await fetch(`/api/staff/rooms/${roomId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (input.handleStaffAuthFailure(res.status)) return
        dispatchRoom({ type: "SET_ROOM_ACTION_ERROR", roomId, error: resolveRoomActionErrorMessage(data, "Unable to disable room.") })
        return
      }
      await input.fetchSchoolData({ showLoader: false })
      if (roomForm.id === roomId) resetRoomForm()
      dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: typeof data?.message === "string" ? data.message : "Room disabled." })
    } catch {
      dispatchRoom({ type: "SET_ROOM_ACTION_ERROR", roomId, error: "Network error while disabling room." })
    } finally {
      dispatchRoom({ type: "SET_ROOM_BUSY_ID", payload: null })
    }
  }, [input, resetRoomForm, roomForm.id, setRoomActionBusy])

  const activateRoom = React.useCallback(async (roomId: string) => {
    setRoomActionBusy(roomId)
    try {
      const res = await fetch(`/api/staff/rooms/${roomId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (input.handleStaffAuthFailure(res.status)) return
        dispatchRoom({ type: "SET_ROOM_ACTION_ERROR", roomId, error: resolveRoomActionErrorMessage(data, "Unable to activate room.") })
        return
      }
      await input.fetchSchoolData({ showLoader: false })
      dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: typeof data?.message === "string" ? data.message : "Room activated." })
    } catch {
      dispatchRoom({ type: "SET_ROOM_ACTION_ERROR", roomId, error: "Network error while activating room." })
    } finally {
      dispatchRoom({ type: "SET_ROOM_BUSY_ID", payload: null })
    }
  }, [input, setRoomActionBusy])

  // ---------------------------------------------------------------------------
  // Safe-delete modal callbacks
  // ---------------------------------------------------------------------------

  const openRoomSafeDeleteModal = React.useCallback((room: RoomRow) => {
    dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: null })
    dispatchRoom({ type: "SET_ROOM_SAFE_DELETE_MODAL", payload: { room, reason: "", error: null } })
  }, [])

  const closeRoomSafeDeleteModal = React.useCallback(() => {
    dispatchRoom({ type: "SET_ROOM_SAFE_DELETE_MODAL", payload: null })
  }, [])

  const updateRoomSafeDeleteReason = React.useCallback((reason: string) => {
    dispatchRoom({
      type: "PATCH_ROOM_SAFE_DELETE_MODAL",
      patch: {
        reason,
        // Clear the specific validation error when user is typing a reason
        ...(roomSafeDeleteModal?.error === "Deletion reason is required." ? { error: null } : {}),
      },
    })
  }, [roomSafeDeleteModal?.error])

  // ---------------------------------------------------------------------------
  // Reassign modal callbacks
  // ---------------------------------------------------------------------------

  const openRoomReassignModal = React.useCallback((room: RoomRow) => {
    const affectedCourses = input.courses
      .filter((course) => course.defaultRoomId === room.id)
      .map((course) => ({
        id: course.id,
        title: course.title,
        slug: course.slug,
        scheduleLabel: buildAssignmentCourseScheduleLabel(course),
      }))

    dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: null })
    dispatchRoom({
      type: "SET_ROOM_REASSIGN_MODAL",
      payload: {
        room,
        targetRoomId: "",
        moveFutureSessions: false,
        availableCourses: affectedCourses,
        selectedCourseIds: affectedCourses.map((course) => course.id),
        error: null,
      },
    })
  }, [input.courses])

  const closeRoomReassignModal = React.useCallback(() => {
    dispatchRoom({ type: "SET_ROOM_REASSIGN_MODAL", payload: null })
  }, [])

  const updateRoomReassignTarget = React.useCallback((targetRoomId: string) => {
    dispatchRoom({
      type: "PATCH_ROOM_REASSIGN_MODAL",
      patch: {
        targetRoomId,
        ...(roomReassignModal?.error === "Select a target room to continue." ? { error: null } : {}),
      },
    })
  }, [roomReassignModal?.error])

  const updateRoomReassignMoveFutureSessions = React.useCallback((moveFutureSessions: boolean) => {
    dispatchRoom({ type: "PATCH_ROOM_REASSIGN_MODAL", patch: { moveFutureSessions } })
  }, [])

  const updateRoomReassignCourseSelection = React.useCallback((courseId: string, selected: boolean) => {
    if (!roomReassignModal) return
    const selectedCourseIds = selected
      ? [...roomReassignModal.selectedCourseIds, courseId]
      : roomReassignModal.selectedCourseIds.filter((id) => id !== courseId)
    dispatchRoom({
      type: "PATCH_ROOM_REASSIGN_MODAL",
      patch: {
        selectedCourseIds,
        ...(roomReassignModal.error === "Select at least one course to reassign." ? { error: null } : {}),
      },
    })
  }, [roomReassignModal])

  // ---------------------------------------------------------------------------
  // Safe-delete and reassign async actions
  // ---------------------------------------------------------------------------

  const confirmRoomSafeDelete = React.useCallback(async () => {
    if (!roomSafeDeleteModal) return
    const room = roomSafeDeleteModal.room
    const reason = roomSafeDeleteModal.reason.trim()
    if (!reason) {
      dispatchRoom({ type: "PATCH_ROOM_SAFE_DELETE_MODAL", patch: { error: "Deletion reason is required." } })
      return
    }

    setRoomActionBusy(room.id)
    dispatchRoom({ type: "PATCH_ROOM_SAFE_DELETE_MODAL", patch: { error: null } })
    try {
      const res = await fetch(`/api/staff/rooms/${room.id}/safe-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (input.handleStaffAuthFailure(res.status)) return
        const nextError = resolveRoomActionErrorMessage(data, "Unable to safe-delete room.")
        if (roomSafeDeleteModal.room.id === room.id) {
          dispatchRoom({ type: "PATCH_ROOM_SAFE_DELETE_MODAL", patch: { error: nextError } })
        }
        dispatchRoom({ type: "SET_ROOM_ACTION_ERROR", roomId: room.id, error: nextError })
        return
      }

      await input.fetchSchoolData({ showLoader: false })
      if (roomForm.id === room.id) resetRoomForm()
      closeRoomSafeDeleteModal()
      dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: "Room deleted." })
    } catch {
      const nextError = "Network error while deleting room."
      dispatchRoom({ type: "PATCH_ROOM_SAFE_DELETE_MODAL", patch: { error: nextError } })
      dispatchRoom({ type: "SET_ROOM_ACTION_ERROR", roomId: room.id, error: nextError })
    } finally {
      dispatchRoom({ type: "SET_ROOM_BUSY_ID", payload: null })
    }
  }, [closeRoomSafeDeleteModal, input, resetRoomForm, roomForm.id, roomSafeDeleteModal, setRoomActionBusy])

  const confirmRoomReassign = React.useCallback(async () => {
    if (!roomReassignModal) return
    const room = roomReassignModal.room
    const targetRoomId = roomReassignModal.targetRoomId
    const selectedCourseIds = roomReassignModal.selectedCourseIds
    if (!targetRoomId) {
      dispatchRoom({ type: "PATCH_ROOM_REASSIGN_MODAL", patch: { error: "Select a target room to continue." } })
      return
    }
    if (roomReassignModal.availableCourses.length > 0 && selectedCourseIds.length === 0) {
      dispatchRoom({ type: "PATCH_ROOM_REASSIGN_MODAL", patch: { error: "Select at least one course to reassign." } })
      return
    }

    setRoomActionBusy(room.id)
    dispatchRoom({ type: "PATCH_ROOM_REASSIGN_MODAL", patch: { error: null } })
    try {
      const res = await fetch(`/api/staff/rooms/${room.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRoomId,
          moveFutureSessions: roomReassignModal.moveFutureSessions,
          courseIds: selectedCourseIds,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (input.handleStaffAuthFailure(res.status)) return
        const nextError = resolveRoomActionErrorMessage(data, "Unable to reassign room.")
        if (roomReassignModal.room.id === room.id) {
          dispatchRoom({ type: "PATCH_ROOM_REASSIGN_MODAL", patch: { error: nextError } })
        }
        dispatchRoom({ type: "SET_ROOM_ACTION_ERROR", roomId: room.id, error: nextError })
        return
      }

      const movedSessions = typeof data?.movedSessions === "number" ? data.movedSessions : 0
      const movedDefaults = typeof data?.reassignedDefaults === "number" ? data.reassignedDefaults : 0
      await input.fetchSchoolData({ showLoader: false })
      closeRoomReassignModal()
      dispatchRoom({ type: "SET_ROOM_FORM_SUCCESS", payload: `Room reassigned. Defaults moved: ${movedDefaults}. Future sessions moved: ${movedSessions}.` })
    } catch {
      const nextError = "Network error while reassigning room."
      dispatchRoom({ type: "PATCH_ROOM_REASSIGN_MODAL", patch: { error: nextError } })
      dispatchRoom({ type: "SET_ROOM_ACTION_ERROR", roomId: room.id, error: nextError })
    } finally {
      dispatchRoom({ type: "SET_ROOM_BUSY_ID", payload: null })
    }
  }, [closeRoomReassignModal, input, roomReassignModal, setRoomActionBusy])

  // ---------------------------------------------------------------------------
  // Reservation async actions
  // ---------------------------------------------------------------------------

  const saveRoomReservation = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    dispatchReservation({ type: "SET_RESERVATION_SAVING", payload: true })
    dispatchReservation({ type: "SET_RESERVATION_FORM_ERROR", payload: null })
    dispatchReservation({ type: "SET_RESERVATION_FORM_SUCCESS", payload: null })
    try {
      const effectiveEndDate = roomReservationForm.endDate || roomReservationForm.startDate
      const startsAtDate = buildReservationDateTime(roomReservationForm.startDate, roomReservationForm.startTime)
      const endsAtDate = buildReservationDateTime(effectiveEndDate, roomReservationForm.endTime)
      if (!startsAtDate || !endsAtDate) {
        dispatchReservation({ type: "SET_RESERVATION_FORM_ERROR", payload: "Select a valid start/end date and time." })
        return
      }
      if (endsAtDate.getTime() <= startsAtDate.getTime()) {
        dispatchReservation({ type: "SET_RESERVATION_FORM_ERROR", payload: "End date/time must be after start date/time. For overnight events, choose the next day as end date." })
        return
      }
      const res = await fetch("/api/staff/room-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: roomReservationForm.roomId,
          title: roomReservationForm.title.trim(),
          reason: roomReservationForm.reason.trim(),
          startsAt: startsAtDate.toISOString(),
          endsAt: endsAtDate.toISOString(),
          ...(roomReservationForm.assignedStaffClerkUserId
            ? { assignedStaffClerkUserId: roomReservationForm.assignedStaffClerkUserId }
            : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (input.handleStaffAuthFailure(res.status)) return
        dispatchReservation({ type: "SET_RESERVATION_FORM_ERROR", payload: resolveRoomActionErrorMessage(data, "Unable to create reservation.") })
        return
      }
      await input.fetchSchoolData({ showLoader: false })
      dispatchReservation({ type: "SET_RESERVATION_FORM", payload: createEmptyRoomReservationForm() })
      dispatchReservation({ type: "SET_RESERVATION_FORM_SUCCESS", payload: "Reservation created." })
    } catch {
      dispatchReservation({ type: "SET_RESERVATION_FORM_ERROR", payload: "Network error while creating reservation." })
    } finally {
      dispatchReservation({ type: "SET_RESERVATION_SAVING", payload: false })
    }
  }, [input, roomReservationForm])

  const closeRoomReservationCancelModal = React.useCallback(() => {
    dispatchReservation({ type: "SET_RESERVATION_CANCEL_MODAL", payload: null })
  }, [])

  const openRoomReservationCancelModal = React.useCallback((reservation: RoomReservationRow) => {
    dispatchReservation({ type: "SET_RESERVATION_FORM_SUCCESS", payload: null })
    dispatchReservation({ type: "SET_RESERVATION_CANCEL_MODAL", payload: { reservation, reason: "", error: null } })
  }, [])

  const updateRoomReservationCancelReason = React.useCallback((reason: string) => {
    dispatchReservation({ type: "PATCH_RESERVATION_CANCEL_MODAL", patch: { reason, error: null } })
  }, [])

  const confirmRoomReservationCancel = React.useCallback(async () => {
    if (!roomReservationCancelModal) return
    const reservation = roomReservationCancelModal.reservation
    dispatchReservation({ type: "SET_RESERVATION_BUSY_ID", payload: reservation.id })
    dispatchReservation({ type: "SET_RESERVATION_FORM_ERROR", payload: null })
    try {
      const res = await fetch(`/api/staff/room-reservations/${reservation.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: roomReservationCancelModal.reason.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (input.handleStaffAuthFailure(res.status)) return
        const nextError = resolveRoomActionErrorMessage(data, "Unable to cancel reservation.")
        dispatchReservation({ type: "PATCH_RESERVATION_CANCEL_MODAL", patch: { error: nextError } })
        return
      }
      await input.fetchSchoolData({ showLoader: false })
      closeRoomReservationCancelModal()
      dispatchReservation({ type: "SET_RESERVATION_FORM_SUCCESS", payload: "Reservation cancelled." })
    } catch {
      dispatchReservation({ type: "PATCH_RESERVATION_CANCEL_MODAL", patch: { error: "Network error while cancelling reservation." } })
    } finally {
      dispatchReservation({ type: "SET_RESERVATION_BUSY_ID", payload: null })
    }
  }, [closeRoomReservationCancelModal, input, roomReservationCancelModal])

  const setRoomSearchQuery = React.useCallback((v: string) => dispatchRoom({ type: "SET_ROOM_SEARCH_QUERY", payload: v }), [])
  const setRoomStatusFilter = React.useCallback((v: "all" | "active" | "inactive") => dispatchRoom({ type: "SET_ROOM_STATUS_FILTER", payload: v }), [])

  // ---------------------------------------------------------------------------
  // Public interface — identical to original
  // ---------------------------------------------------------------------------

  return {
    roomForm,
    roomSearchQuery,
    roomStatusFilter,
    roomSaving,
    roomBusyId,
    roomFormError,
    roomFormSuccess,
    roomActionErrors,
    roomSafeDeleteModal,
    roomReassignModal,
    roomReservationForm,
    roomReservationSaving,
    roomReservationCancelModal,
    roomReservationBusyId,
    roomReservationFormError,
    roomReservationFormSuccess,
    roomById,
    activeRoomOptions,
    courseRoomOptions,
    visibleRooms,
    currentUpcomingReservations,
    reservationAssignableStaff,
    reservationStaffLabelById,
    reservationRangePreview,
    setRoomSearchQuery,
    setRoomStatusFilter,
    resetRoomForm,
    updateRoomFormField,
    loadRoomIntoForm,
    saveRoom,
    disableRoom,
    activateRoom,
    openRoomSafeDeleteModal,
    closeRoomSafeDeleteModal,
    updateRoomSafeDeleteReason,
    openRoomReassignModal,
    closeRoomReassignModal,
    updateRoomReassignTarget,
    updateRoomReassignMoveFutureSessions,
    updateRoomReassignCourseSelection,
    confirmRoomSafeDelete,
    confirmRoomReassign,
    updateRoomReservationFormField,
    updateRoomReservationDateRange,
    saveRoomReservation,
    closeRoomReservationCancelModal,
    openRoomReservationCancelModal,
    updateRoomReservationCancelReason,
    confirmRoomReservationCancel,
    formatReservationDateLabel,
    resolveRoomDisableActionState,
  }
}
