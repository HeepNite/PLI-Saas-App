import React from "react"
import type { CourseData } from "@/constants/courses"
import { getAvailableTimesForCourseDate, isSlotInPastForTimeZone } from "@/lib/class-schedule"
import type { BookingItem, SlotAvailability } from "../profile-types"
import { NY_TIMEZONE } from "../profile-constants"
import { formatDateKeyInTimeZone, formatTimeKeyInTimeZone } from "../profile-formatters"

type RescheduleStep = 1 | 2 | 3

type UseRescheduleFlowParams = {
  bookings: BookingItem[]
  visibleBookings: BookingItem[]
  selectedBooking: BookingItem | null
  selectedBookingId: string
  setSelectedBookingId: React.Dispatch<React.SetStateAction<string>>
  sourceCourses: CourseData[]
  fetchAvailability: (courseSlug: string, date: string, attendanceId?: string) => Promise<SlotAvailability[] | null>
  clearAvailabilityCache: () => void
  loadBookings: () => Promise<{ bookings: BookingItem[]; packages: Array<{ isUnlimited: boolean; remainingCredits: number | null }> } | null | undefined>
  loadActionRequests: () => Promise<void>
}

export type RescheduleFlowState = {
  changeModalOpen: boolean
  rescheduleStep: RescheduleStep
  setRescheduleStep: React.Dispatch<React.SetStateAction<RescheduleStep>>
  rescheduleCourseSlug: string
  setRescheduleCourseSlug: React.Dispatch<React.SetStateAction<string>>
  rescheduleDate: string
  setRescheduleDate: React.Dispatch<React.SetStateAction<string>>
  rescheduleTime: string
  setRescheduleTime: React.Dispatch<React.SetStateAction<string>>
  availability: SlotAvailability[]
  availabilityLoading: boolean
  rescheduleSaving: boolean
  rescheduleError: string | null
  setRescheduleError: React.Dispatch<React.SetStateAction<string | null>>
  rescheduleSuccess: string | null
  rescheduleCourseOptions: Array<{ slug: string; title: string }>
  rescheduleScopedBookings: BookingItem[]
  rescheduleBookedTimesForSelectedDate: Set<string>
  isCurrentRescheduleSlot: (date: string, time: string) => boolean
  isRescheduleDateBlocked: (dateIso: string) => boolean
  getRescheduleDateBlockReason: (dateIso: string) => string | undefined
  loadAvailability: (courseSlug: string, date: string, attendanceId?: string) => Promise<void>
  hydrateRescheduleFromBooking: (booking: BookingItem | null) => void
  openChangeClassModalForBooking: (bookingId: string) => boolean
  openChangeClassModal: () => void
  closeChangeClassModal: () => void
  continueRescheduleStep: () => void
  submitPrimaryReschedule: () => Promise<void>
}

export function useRescheduleFlow({
  bookings,
  visibleBookings,
  selectedBooking,
  selectedBookingId,
  setSelectedBookingId,
  sourceCourses,
  fetchAvailability,
  clearAvailabilityCache,
  loadBookings,
  loadActionRequests,
}: UseRescheduleFlowParams): RescheduleFlowState {
  const [changeModalOpen, setChangeModalOpen] = React.useState(false)
  const [rescheduleStep, setRescheduleStep] = React.useState<RescheduleStep>(1)
  const [rescheduleCourseSlug, setRescheduleCourseSlug] = React.useState("")
  const [rescheduleDate, setRescheduleDate] = React.useState("")
  const [rescheduleTime, setRescheduleTime] = React.useState("")
  const [availability, setAvailability] = React.useState<SlotAvailability[]>([])
  const [availabilityLoading, setAvailabilityLoading] = React.useState(false)
  const [rescheduleSaving, setRescheduleSaving] = React.useState(false)
  const [rescheduleError, setRescheduleError] = React.useState<string | null>(null)
  const [rescheduleSuccess, setRescheduleSuccess] = React.useState<string | null>(null)
  const rescheduleAvailabilityRequestRef = React.useRef(0)

  const selectedBookingDateKey = React.useMemo(
    () => (selectedBooking ? formatDateKeyInTimeZone(selectedBooking.startsAt, NY_TIMEZONE) : ""),
    [selectedBooking]
  )
  const selectedBookingTimeKey = React.useMemo(
    () => (selectedBooking ? formatTimeKeyInTimeZone(selectedBooking.startsAt, NY_TIMEZONE) : ""),
    [selectedBooking]
  )
  const isCurrentRescheduleSlot = React.useCallback(
    (date: string, time: string) => {
      if (!selectedBookingDateKey || !selectedBookingTimeKey) return false
      return date === selectedBookingDateKey && time === selectedBookingTimeKey
    },
    [selectedBookingDateKey, selectedBookingTimeKey]
  )
  const rescheduleCourseOptions = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const booking of visibleBookings) {
      if (!map.has(booking.courseSlug)) {
        map.set(booking.courseSlug, booking.courseTitle)
      }
    }
    return Array.from(map.entries()).map(([slug, title]) => ({ slug, title }))
  }, [visibleBookings])
  const rescheduleScopedBookings = React.useMemo(() => {
    if (!rescheduleCourseSlug) return visibleBookings
    return visibleBookings.filter((booking) => booking.courseSlug === rescheduleCourseSlug)
  }, [rescheduleCourseSlug, visibleBookings])
  const rescheduleBookedTimesByDate = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const booking of bookings) {
      if (booking.id === selectedBookingId) continue
      const dateKey = formatDateKeyInTimeZone(booking.startsAt, NY_TIMEZONE)
      const timeKey = formatTimeKeyInTimeZone(booking.startsAt, NY_TIMEZONE)
      if (!dateKey || !timeKey) continue
      const current = map.get(dateKey) || new Set<string>()
      current.add(timeKey)
      map.set(dateKey, current)
    }
    return map
  }, [bookings, selectedBookingId])
  const rescheduleBookedTimesForSelectedDate = React.useMemo(() => {
    if (!rescheduleDate) return new Set<string>()
    return rescheduleBookedTimesByDate.get(rescheduleDate) || new Set<string>()
  }, [rescheduleBookedTimesByDate, rescheduleDate])

  const isRescheduleDateBlocked = React.useCallback(
    (dateIso: string) => {
      if (!selectedBooking?.courseSlug) return false
      const availableTimes = getAvailableTimesForCourseDate(selectedBooking.courseSlug, dateIso, sourceCourses)
      if (!availableTimes.length) return false
      const futureTimes = availableTimes.filter((time) => !isSlotInPastForTimeZone(dateIso, time, NY_TIMEZONE))
      if (!futureTimes.length) return true
      const occupied = rescheduleBookedTimesByDate.get(dateIso)
      if (!occupied || occupied.size === 0) return false
      return futureTimes.every((time) => occupied.has(time))
    },
    [rescheduleBookedTimesByDate, selectedBooking?.courseSlug, sourceCourses]
  )
  const getRescheduleDateBlockReason = React.useCallback(
    (dateIso: string) => {
      if (!selectedBooking?.courseSlug) return undefined
      const availableTimes = getAvailableTimesForCourseDate(selectedBooking.courseSlug, dateIso, sourceCourses)
      if (!availableTimes.length) return undefined
      const futureTimes = availableTimes.filter((time) => !isSlotInPastForTimeZone(dateIso, time, NY_TIMEZONE))
      if (!futureTimes.length) return "The time slots for this day have already passed."
      const occupied = rescheduleBookedTimesByDate.get(dateIso)
      if (occupied && futureTimes.every((time) => occupied.has(time))) {
        return "That time slot on that day is already taken by another class."
      }
      return undefined
    },
    [rescheduleBookedTimesByDate, selectedBooking?.courseSlug, sourceCourses]
  )

  const loadAvailability = React.useCallback(
    async (courseSlug: string, date: string, attendanceId?: string) => {
      if (!courseSlug || !date) {
        setAvailability([])
        return
      }
      const requestId = ++rescheduleAvailabilityRequestRef.current
      setAvailabilityLoading(true)
      try {
        const slots = await fetchAvailability(courseSlug, date, attendanceId)
        if (requestId !== rescheduleAvailabilityRequestRef.current) return
        if (!slots) {
          setAvailability([])
          return
        }
        setAvailability(slots)
      } catch {
        if (requestId !== rescheduleAvailabilityRequestRef.current) return
        setAvailability([])
      } finally {
        if (requestId !== rescheduleAvailabilityRequestRef.current) return
        setAvailabilityLoading(false)
      }
    },
    [fetchAvailability]
  )

  const hydrateRescheduleFromBooking = React.useCallback(
    (booking: BookingItem | null) => {
      if (!booking) {
        setRescheduleDate("")
        setRescheduleTime("")
        setAvailability([])
        return
      }
      const startsAt = new Date(booking.startsAt)
      if (Number.isNaN(startsAt.getTime())) {
        setRescheduleDate("")
        setRescheduleTime("")
        setAvailability([])
        return
      }
      const dateIso = formatDateKeyInTimeZone(startsAt, NY_TIMEZONE)
      const timeKey = formatTimeKeyInTimeZone(startsAt, NY_TIMEZONE)
      setRescheduleDate(dateIso)
      setRescheduleTime(timeKey)
      if (dateIso) {
        void loadAvailability(booking.courseSlug, dateIso, booking.id)
      } else {
        setAvailability([])
      }
    },
    [loadAvailability]
  )

  const openChangeClassModalForBooking = React.useCallback(
    (bookingId: string) => {
      const booking = visibleBookings.find((item) => item.id === bookingId) || null
      if (!booking) {
        setRescheduleError("You don't have a scheduled class to change.")
        return false
      }
      setRescheduleError(null)
      setRescheduleSuccess(null)
      setRescheduleStep(1)
      setSelectedBookingId(booking.id)
      setRescheduleCourseSlug(booking.courseSlug)
      hydrateRescheduleFromBooking(booking)
      setChangeModalOpen(true)
      return true
    },
    [hydrateRescheduleFromBooking, setSelectedBookingId, visibleBookings]
  )

  const openChangeClassModal = React.useCallback(() => {
    if (!selectedBooking) {
      setRescheduleError("You don't have a scheduled class to change.")
      return
    }
    openChangeClassModalForBooking(selectedBooking.id)
  }, [openChangeClassModalForBooking, selectedBooking])

  const closeChangeClassModal = React.useCallback(() => {
    setChangeModalOpen(false)
    setRescheduleStep(1)
    setRescheduleCourseSlug("")
    setRescheduleError(null)
    setRescheduleSuccess(null)
  }, [])

  const continueRescheduleStep = React.useCallback(() => {
    if (!selectedBooking || !rescheduleDate || !rescheduleTime) {
      setRescheduleError("Select date and time.")
      return
    }
    if (isSlotInPastForTimeZone(rescheduleDate, rescheduleTime, NY_TIMEZONE)) {
      setRescheduleError("That time slot has already passed.")
      return
    }
    if (isCurrentRescheduleSlot(rescheduleDate, rescheduleTime)) {
      setRescheduleError("You can't reassign to the same day and current time slot.")
      return
    }
    if (rescheduleBookedTimesForSelectedDate.has(rescheduleTime)) {
      setRescheduleError("That time slot on that day is already taken by another class.")
      return
    }
    setRescheduleError(null)
    setRescheduleSuccess(null)
    setRescheduleStep(2)
  }, [isCurrentRescheduleSlot, rescheduleBookedTimesForSelectedDate, rescheduleDate, rescheduleTime, selectedBooking])

  const postReschedule = async (attendanceId: string, date: string, time: string) => {
    const res = await fetch("/api/profile/bookings/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId, date, time }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false as const,
        error: data?.error || "Unable to change class.",
      }
    }
    return { ok: true as const }
  }

  const submitPrimaryReschedule = React.useCallback(async () => {
    if (!selectedBooking || !rescheduleDate || !rescheduleTime) {
      setRescheduleError("Select date and time.")
      return
    }
    setRescheduleSaving(true)
    setRescheduleError(null)
    setRescheduleSuccess(null)
    const primaryId = selectedBooking.id
    try {
      const result = await postReschedule(primaryId, rescheduleDate, rescheduleTime)
      if (!result.ok) {
        setRescheduleError(result.error)
        return
      }
      clearAvailabilityCache()

      const refreshed = await loadBookings()
      await loadActionRequests()

      const refreshedPackages = refreshed?.packages || []
      const hasPendingAssignments = refreshedPackages.some((pkg) => pkg.isUnlimited || (pkg.remainingCredits ?? 0) > 0)
      setRescheduleSuccess("Class rescheduled successfully.")
      if (hasPendingAssignments) {
        setRescheduleStep(3)
      } else {
        window.setTimeout(() => closeChangeClassModal(), 700)
      }
    } catch {
      setRescheduleError("Unable to change class.")
    } finally {
      setRescheduleSaving(false)
    }
  }, [clearAvailabilityCache, closeChangeClassModal, loadActionRequests, loadBookings, rescheduleDate, rescheduleTime, selectedBooking])

  React.useEffect(() => {
    if (!changeModalOpen || !selectedBooking || !rescheduleDate) return
    void loadAvailability(selectedBooking.courseSlug, rescheduleDate, selectedBooking.id)
  }, [changeModalOpen, selectedBooking, rescheduleDate, loadAvailability])

  React.useEffect(() => {
    if (!rescheduleTime) return
    const validSelection = availability.some(
      (slot) =>
        slot.time === rescheduleTime &&
        !slot.isFull &&
        !slot.isPast &&
        !rescheduleBookedTimesForSelectedDate.has(slot.time) &&
        !isCurrentRescheduleSlot(rescheduleDate, slot.time)
    )
    if (!validSelection) {
      setRescheduleTime("")
    }
  }, [availability, isCurrentRescheduleSlot, rescheduleBookedTimesForSelectedDate, rescheduleDate, rescheduleTime])

  React.useEffect(() => {
    if (!rescheduleDate) return
    if (!isRescheduleDateBlocked(rescheduleDate)) return
    const blockReason = getRescheduleDateBlockReason(rescheduleDate)
    setRescheduleDate("")
    setRescheduleTime("")
    setAvailability([])
    setRescheduleError(blockReason || "That day no longer has available time slots.")
  }, [getRescheduleDateBlockReason, isRescheduleDateBlocked, rescheduleDate])

  React.useEffect(() => {
    if (!changeModalOpen || !rescheduleCourseSlug) return
    const scoped = bookings.filter((booking) => booking.courseSlug === rescheduleCourseSlug)
    if (!scoped.length) return
    if (!scoped.some((booking) => booking.id === selectedBookingId)) {
      const first = scoped[0]
      setSelectedBookingId(first.id)
      hydrateRescheduleFromBooking(first)
    }
  }, [bookings, changeModalOpen, hydrateRescheduleFromBooking, rescheduleCourseSlug, selectedBookingId, setSelectedBookingId])

  return {
    changeModalOpen,
    rescheduleStep,
    setRescheduleStep,
    rescheduleCourseSlug,
    setRescheduleCourseSlug,
    rescheduleDate,
    setRescheduleDate,
    rescheduleTime,
    setRescheduleTime,
    availability,
    availabilityLoading,
    rescheduleSaving,
    rescheduleError,
    setRescheduleError,
    rescheduleSuccess,
    rescheduleCourseOptions,
    rescheduleScopedBookings,
    rescheduleBookedTimesForSelectedDate,
    isCurrentRescheduleSlot,
    isRescheduleDateBlocked,
    getRescheduleDateBlockReason,
    loadAvailability,
    hydrateRescheduleFromBooking,
    openChangeClassModalForBooking,
    openChangeClassModal,
    closeChangeClassModal,
    continueRescheduleStep,
    submitPrimaryReschedule,
  }
}
