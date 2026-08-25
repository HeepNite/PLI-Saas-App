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

export const useStaffRoomsAdmin = (input: {
  rooms: RoomRow[]
  reservations: RoomReservationRow[]
  courses: SchoolCourseRow[]
  staffRows: StaffUserRow[]
  selectedCourseDefaultRoomId: string
  fetchSchoolData: FetchSchoolData
  handleStaffAuthFailure: (status: number) => boolean
}) => {
  const [roomForm, setRoomForm] = React.useState<RoomFormState>(() => createInitialRoomForm())
  const [roomSearchQuery, setRoomSearchQuery] = React.useState("")
  const [roomStatusFilter, setRoomStatusFilter] = React.useState<"all" | "active" | "inactive">("all")
  const [roomSaving, setRoomSaving] = React.useState(false)
  const [roomBusyId, setRoomBusyId] = React.useState<string | null>(null)
  const [roomFormError, setRoomFormError] = React.useState<string | null>(null)
  const [roomFormSuccess, setRoomFormSuccess] = React.useState<string | null>(null)
  const [roomActionErrors, setRoomActionErrors] = React.useState<Record<string, string>>({})
  const [roomSafeDeleteModal, setRoomSafeDeleteModal] = React.useState<RoomSafeDeleteModalState | null>(null)
  const [roomReassignModal, setRoomReassignModal] = React.useState<RoomReassignModalState | null>(null)
  const [roomReservationForm, setRoomReservationForm] = React.useState<RoomReservationFormState>(() => createEmptyRoomReservationForm())
  const [roomReservationSaving, setRoomReservationSaving] = React.useState(false)
  const [roomReservationCancelModal, setRoomReservationCancelModal] = React.useState<RoomReservationCancelModalState | null>(null)
  const [roomReservationBusyId, setRoomReservationBusyId] = React.useState<string | null>(null)
  const [roomReservationFormError, setRoomReservationFormError] = React.useState<string | null>(null)
  const [roomReservationFormSuccess, setRoomReservationFormSuccess] = React.useState<string | null>(null)

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

  const resetRoomForm = React.useCallback(() => {
    setRoomForm(createInitialRoomForm())
    setRoomFormError(null)
    setRoomFormSuccess(null)
  }, [])

  const updateRoomFormField = React.useCallback(<Field extends keyof RoomFormState>(field: Field, value: RoomFormState[Field]) => {
    setRoomForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const loadRoomIntoForm = React.useCallback((room: RoomRow) => {
    setRoomForm(createRoomFormFromRoom(room))
    setRoomFormError(null)
    setRoomFormSuccess(null)
  }, [])

  const updateRoomReservationFormField = React.useCallback(
    <Field extends keyof RoomReservationFormState>(field: Field, value: RoomReservationFormState[Field]) => {
      setRoomReservationForm((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const updateRoomReservationDateRange = React.useCallback((startDate: string, endDate: string | null) => {
    setRoomReservationForm((prev) => ({ ...prev, startDate, endDate: endDate || "" }))
  }, [])

  const saveRoom = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setRoomSaving(true)
    setRoomFormError(null)
    setRoomFormSuccess(null)
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
        setRoomFormError(typeof data?.error === "string" ? data.error : "Unable to save room.")
        return
      }
      const nextSuccess = typeof data?.message === "string" ? data.message : isEditing ? "Room updated." : "Room created."
      await input.fetchSchoolData({ showLoader: false })
      resetRoomForm()
      setRoomFormSuccess(nextSuccess)
    } catch {
      setRoomFormError("Network error while saving room.")
    } finally {
      setRoomSaving(false)
    }
  }, [input, resetRoomForm, roomForm])

  const setRoomActionBusy = React.useCallback((roomId: string) => {
    setRoomBusyId(roomId)
    setRoomActionErrors((prev) => clearRecordEntry(prev, roomId))
    setRoomFormSuccess(null)
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
        setRoomActionErrors((prev) => ({ ...prev, [roomId]: resolveRoomActionErrorMessage(data, "Unable to disable room.") }))
        return
      }
      await input.fetchSchoolData({ showLoader: false })
      if (roomForm.id === roomId) resetRoomForm()
      setRoomFormSuccess(typeof data?.message === "string" ? data.message : "Room disabled.")
    } catch {
      setRoomActionErrors((prev) => ({ ...prev, [roomId]: "Network error while disabling room." }))
    } finally {
      setRoomBusyId(null)
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
        setRoomActionErrors((prev) => ({ ...prev, [roomId]: resolveRoomActionErrorMessage(data, "Unable to activate room.") }))
        return
      }
      await input.fetchSchoolData({ showLoader: false })
      setRoomFormSuccess(typeof data?.message === "string" ? data.message : "Room activated.")
    } catch {
      setRoomActionErrors((prev) => ({ ...prev, [roomId]: "Network error while activating room." }))
    } finally {
      setRoomBusyId(null)
    }
  }, [input, setRoomActionBusy])

  const openRoomSafeDeleteModal = React.useCallback((room: RoomRow) => {
    setRoomFormSuccess(null)
    setRoomSafeDeleteModal({ room, reason: "", error: null })
  }, [])

  const closeRoomSafeDeleteModal = React.useCallback(() => setRoomSafeDeleteModal(null), [])

  const updateRoomSafeDeleteReason = React.useCallback((reason: string) => {
    setRoomSafeDeleteModal((prev) => {
      if (!prev) return prev
      return { ...prev, reason, error: prev.error === "Deletion reason is required." ? null : prev.error }
    })
  }, [])

  const openRoomReassignModal = React.useCallback((room: RoomRow) => {
    const affectedCourses = input.courses
      .filter((course) => course.defaultRoomId === room.id)
      .map((course) => ({
        id: course.id,
        title: course.title,
        slug: course.slug,
        scheduleLabel: buildAssignmentCourseScheduleLabel(course),
      }))

    setRoomFormSuccess(null)
    setRoomReassignModal({
      room,
      targetRoomId: "",
      moveFutureSessions: false,
      availableCourses: affectedCourses,
      selectedCourseIds: affectedCourses.map((course) => course.id),
      error: null,
    })
  }, [input.courses])

  const closeRoomReassignModal = React.useCallback(() => setRoomReassignModal(null), [])

  const updateRoomReassignTarget = React.useCallback((targetRoomId: string) => {
    setRoomReassignModal((prev) => {
      if (!prev) return prev
      return { ...prev, targetRoomId, error: prev.error === "Select a target room to continue." ? null : prev.error }
    })
  }, [])

  const updateRoomReassignMoveFutureSessions = React.useCallback((moveFutureSessions: boolean) => {
    setRoomReassignModal((prev) => (prev ? { ...prev, moveFutureSessions } : prev))
  }, [])

  const updateRoomReassignCourseSelection = React.useCallback((courseId: string, selected: boolean) => {
    setRoomReassignModal((prev) => {
      if (!prev) return prev
      const selectedCourseIds = selected
        ? [...prev.selectedCourseIds, courseId]
        : prev.selectedCourseIds.filter((id) => id !== courseId)
      return {
        ...prev,
        selectedCourseIds,
        error: prev.error === "Select at least one course to reassign." ? null : prev.error,
      }
    })
  }, [])

  const confirmRoomSafeDelete = React.useCallback(async () => {
    if (!roomSafeDeleteModal) return
    const room = roomSafeDeleteModal.room
    const reason = roomSafeDeleteModal.reason.trim()
    if (!reason) {
      setRoomSafeDeleteModal((prev) => (prev ? { ...prev, error: "Deletion reason is required." } : prev))
      return
    }

    setRoomActionBusy(room.id)
    setRoomSafeDeleteModal((prev) => (prev ? { ...prev, error: null } : prev))
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
        setRoomSafeDeleteModal((prev) => (prev && prev.room.id === room.id ? { ...prev, error: nextError } : prev))
        setRoomActionErrors((prev) => ({ ...prev, [room.id]: nextError }))
        return
      }

      await input.fetchSchoolData({ showLoader: false })
      if (roomForm.id === room.id) resetRoomForm()
      closeRoomSafeDeleteModal()
      setRoomFormSuccess("Room deleted.")
    } catch {
      const nextError = "Network error while deleting room."
      setRoomSafeDeleteModal((prev) => (prev && prev.room.id === room.id ? { ...prev, error: nextError } : prev))
      setRoomActionErrors((prev) => ({ ...prev, [room.id]: nextError }))
    } finally {
      setRoomBusyId(null)
    }
  }, [closeRoomSafeDeleteModal, input, resetRoomForm, roomForm.id, roomSafeDeleteModal, setRoomActionBusy])

  const confirmRoomReassign = React.useCallback(async () => {
    if (!roomReassignModal) return
    const room = roomReassignModal.room
    const targetRoomId = roomReassignModal.targetRoomId
    const selectedCourseIds = roomReassignModal.selectedCourseIds
    if (!targetRoomId) {
      setRoomReassignModal((prev) => (prev ? { ...prev, error: "Select a target room to continue." } : prev))
      return
    }
    if (roomReassignModal.availableCourses.length > 0 && selectedCourseIds.length === 0) {
      setRoomReassignModal((prev) => (prev ? { ...prev, error: "Select at least one course to reassign." } : prev))
      return
    }

    setRoomActionBusy(room.id)
    setRoomReassignModal((prev) => (prev ? { ...prev, error: null } : prev))
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
        setRoomReassignModal((prev) => (prev && prev.room.id === room.id ? { ...prev, error: nextError } : prev))
        setRoomActionErrors((prev) => ({ ...prev, [room.id]: nextError }))
        return
      }

      const movedSessions = typeof data?.movedSessions === "number" ? data.movedSessions : 0
      const movedDefaults = typeof data?.reassignedDefaults === "number" ? data.reassignedDefaults : 0
      await input.fetchSchoolData({ showLoader: false })
      closeRoomReassignModal()
      setRoomFormSuccess(`Room reassigned. Defaults moved: ${movedDefaults}. Future sessions moved: ${movedSessions}.`)
    } catch {
      const nextError = "Network error while reassigning room."
      setRoomReassignModal((prev) => (prev && prev.room.id === room.id ? { ...prev, error: nextError } : prev))
      setRoomActionErrors((prev) => ({ ...prev, [room.id]: nextError }))
    } finally {
      setRoomBusyId(null)
    }
  }, [closeRoomReassignModal, input, roomReassignModal, setRoomActionBusy])

  const saveRoomReservation = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setRoomReservationSaving(true)
    setRoomReservationFormError(null)
    setRoomReservationFormSuccess(null)
    try {
      const effectiveEndDate = roomReservationForm.endDate || roomReservationForm.startDate
      const startsAtDate = buildReservationDateTime(roomReservationForm.startDate, roomReservationForm.startTime)
      const endsAtDate = buildReservationDateTime(effectiveEndDate, roomReservationForm.endTime)
      if (!startsAtDate || !endsAtDate) {
        setRoomReservationFormError("Select a valid start/end date and time.")
        return
      }
      if (endsAtDate.getTime() <= startsAtDate.getTime()) {
        setRoomReservationFormError("End date/time must be after start date/time. For overnight events, choose the next day as end date.")
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
        setRoomReservationFormError(resolveRoomActionErrorMessage(data, "Unable to create reservation."))
        return
      }
      await input.fetchSchoolData({ showLoader: false })
      setRoomReservationForm(createEmptyRoomReservationForm())
      setRoomReservationFormSuccess("Reservation created.")
    } catch {
      setRoomReservationFormError("Network error while creating reservation.")
    } finally {
      setRoomReservationSaving(false)
    }
  }, [input, roomReservationForm])

  const closeRoomReservationCancelModal = React.useCallback(() => setRoomReservationCancelModal(null), [])

  const openRoomReservationCancelModal = React.useCallback((reservation: RoomReservationRow) => {
    setRoomReservationFormSuccess(null)
    setRoomReservationCancelModal({ reservation, reason: "", error: null })
  }, [])

  const updateRoomReservationCancelReason = React.useCallback((reason: string) => {
    setRoomReservationCancelModal((prev) => (prev ? { ...prev, reason, error: null } : prev))
  }, [])

  const confirmRoomReservationCancel = React.useCallback(async () => {
    if (!roomReservationCancelModal) return
    const reservation = roomReservationCancelModal.reservation
    setRoomReservationBusyId(reservation.id)
    setRoomReservationFormError(null)
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
        setRoomReservationCancelModal((prev) => (prev ? { ...prev, error: nextError } : prev))
        return
      }
      await input.fetchSchoolData({ showLoader: false })
      closeRoomReservationCancelModal()
      setRoomReservationFormSuccess("Reservation cancelled.")
    } catch {
      setRoomReservationCancelModal((prev) => (prev ? { ...prev, error: "Network error while cancelling reservation." } : prev))
    } finally {
      setRoomReservationBusyId(null)
    }
  }, [closeRoomReservationCancelModal, input, roomReservationCancelModal])

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
