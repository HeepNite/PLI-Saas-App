import React from "react"
import type { CourseData } from "@/constants/courses"
import { getAvailableTimesForCourseDate, isSlotInPastForTimeZone } from "@/lib/class-schedule"
import { getPackageAssignmentSummary } from "../profile-utils"
import type { AssignablePackage, BookingItem, PackageAssignmentSummary, SlotAvailability } from "../profile-types"
import { NY_TIMEZONE } from "../profile-constants"
import { formatDateKeyInTimeZone, formatTimeKeyInTimeZone } from "../profile-formatters"

type AssignSlot = { date: string; time: string }

type UseAssignClassesFlowParams = {
  assignPackageId: string
  assignablePackages: AssignablePackage[]
  bookings: BookingItem[]
  sourceCourses: CourseData[]
  todayNyDateKey: string
  fetchAvailability: (courseSlug: string, date: string) => Promise<SlotAvailability[] | null>
  clearAvailabilityCache: () => void
  loadBookings: () => Promise<unknown>
  loadPointsHistory: () => Promise<void>
  loadActionRequests: () => Promise<void>
}

export type AssignClassesFlowState = {
  assignDate: string
  setAssignDate: React.Dispatch<React.SetStateAction<string>>
  assignTime: string
  setAssignTime: React.Dispatch<React.SetStateAction<string>>
  assignAvailability: SlotAvailability[]
  assignAvailabilityLoading: boolean
  assignSlots: AssignSlot[]
  assigning: boolean
  assignError: string | null
  setAssignError: React.Dispatch<React.SetStateAction<string | null>>
  assignSuccess: string | null
  setAssignSuccess: React.Dispatch<React.SetStateAction<string | null>>
  selectedPackageForAssign: AssignablePackage | null
  selectedPackageCourse: CourseData | null
  selectedPackageAssignmentStats: PackageAssignmentSummary | null
  assignUnavailableDates: string[]
  assignBookedTimesForSelectedDate: Set<string>
  addAssignSlot: () => void
  removeAssignSlot: (index: number) => void
  submitAssignClasses: () => Promise<void>
}

export function useAssignClassesFlow({
  assignPackageId,
  assignablePackages,
  bookings,
  sourceCourses,
  todayNyDateKey,
  fetchAvailability,
  clearAvailabilityCache,
  loadBookings,
  loadPointsHistory,
  loadActionRequests,
}: UseAssignClassesFlowParams): AssignClassesFlowState {
  const [assignDate, setAssignDate] = React.useState("")
  const [assignTime, setAssignTime] = React.useState("")
  const [assignAvailability, setAssignAvailability] = React.useState<SlotAvailability[]>([])
  const [assignAvailabilityLoading, setAssignAvailabilityLoading] = React.useState(false)
  const [assignSlots, setAssignSlots] = React.useState<AssignSlot[]>([])
  const [assigning, setAssigning] = React.useState(false)
  const [assignError, setAssignError] = React.useState<string | null>(null)
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null)
  const assignAvailabilityRequestRef = React.useRef(0)

  const selectedPackageForAssign = React.useMemo(
    () => assignablePackages.find((item) => item.id === assignPackageId) || null,
    [assignPackageId, assignablePackages]
  )
  const selectedPackageCourse = React.useMemo(() => {
    if (!selectedPackageForAssign?.courseSlug) return null
    return sourceCourses.find((course) => course.slug === selectedPackageForAssign.courseSlug) || null
  }, [selectedPackageForAssign, sourceCourses])
  const selectedPackageAssignmentStats = React.useMemo(() => {
    if (!selectedPackageForAssign) return null
    const assignedBookingsCount = bookings.filter(
      (booking) => booking.packagePurchaseId === selectedPackageForAssign.id
    ).length
    return getPackageAssignmentSummary({
      isUnlimited: selectedPackageForAssign.isUnlimited,
      totalCredits: selectedPackageForAssign.totalCredits,
      remainingCredits: selectedPackageForAssign.remainingCredits,
      queuedCount: assignSlots.length,
      assignedBookingsCount,
    })
  }, [assignSlots.length, bookings, selectedPackageForAssign])
  const assignBookedTimesByDate = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (!selectedPackageForAssign?.courseSlug) return map
    for (const booking of bookings) {
      if (booking.courseSlug !== selectedPackageForAssign.courseSlug) continue
      const dateKey = formatDateKeyInTimeZone(booking.startsAt)
      const timeKey = formatTimeKeyInTimeZone(booking.startsAt)
      if (!dateKey || !timeKey) continue
      const current = map.get(dateKey) || new Set<string>()
      current.add(timeKey)
      map.set(dateKey, current)
    }
    return map
  }, [bookings, selectedPackageForAssign?.courseSlug])
  const assignUnavailableDates = React.useMemo(() => {
    if (!selectedPackageForAssign?.courseSlug) return [] as string[]
    const dates: string[] = []
    for (const [dateKey, bookedTimes] of assignBookedTimesByDate.entries()) {
      const availableTimes = getAvailableTimesForCourseDate(selectedPackageForAssign.courseSlug, dateKey, sourceCourses)
      if (!availableTimes.length) continue
      const futureTimes = availableTimes.filter((time) => !isSlotInPastForTimeZone(dateKey, time, NY_TIMEZONE))
      if (!futureTimes.length) {
        dates.push(dateKey)
        continue
      }
      const allTaken = futureTimes.every((slot) => bookedTimes.has(slot))
      if (allTaken) dates.push(dateKey)
    }
    const todayAvailableTimes = getAvailableTimesForCourseDate(
      selectedPackageForAssign.courseSlug,
      todayNyDateKey,
      sourceCourses
    )
    if (
      todayAvailableTimes.length > 0 &&
      todayAvailableTimes.every((time) => isSlotInPastForTimeZone(todayNyDateKey, time, NY_TIMEZONE)) &&
      !dates.includes(todayNyDateKey)
    ) {
      dates.push(todayNyDateKey)
    }
    return dates
  }, [assignBookedTimesByDate, selectedPackageForAssign?.courseSlug, sourceCourses, todayNyDateKey])
  const assignBookedTimesForSelectedDate = React.useMemo(() => {
    if (!assignDate) return new Set<string>()
    return assignBookedTimesByDate.get(assignDate) || new Set<string>()
  }, [assignBookedTimesByDate, assignDate])

  const loadAssignAvailability = React.useCallback(
    async (courseSlug: string, date: string) => {
      if (!courseSlug || !date) {
        setAssignAvailability([])
        return
      }
      const requestId = ++assignAvailabilityRequestRef.current
      setAssignAvailabilityLoading(true)
      try {
        const slots = await fetchAvailability(courseSlug, date)
        if (requestId !== assignAvailabilityRequestRef.current) return
        if (!slots) {
          setAssignAvailability([])
          return
        }
        setAssignAvailability(slots)
      } catch {
        if (requestId !== assignAvailabilityRequestRef.current) return
        setAssignAvailability([])
      } finally {
        if (requestId !== assignAvailabilityRequestRef.current) return
        setAssignAvailabilityLoading(false)
      }
    },
    [fetchAvailability]
  )

  const addAssignSlot = React.useCallback(() => {
    if (!assignPackageId) {
      setAssignError("Select a package.")
      return
    }
    if (!assignDate || !assignTime) {
      setAssignError("Select date and time to add the class.")
      return
    }
    if (isSlotInPastForTimeZone(assignDate, assignTime, NY_TIMEZONE)) {
      setAssignError("That time slot has already passed.")
      return
    }
    if (assignBookedTimesForSelectedDate.has(assignTime)) {
      setAssignError("That time slot is already reserved by you.")
      return
    }
    const slotKey = `${assignDate}|${assignTime}`
    if (assignSlots.some((slot) => `${slot.date}|${slot.time}` === slotKey)) {
      setAssignError("That time slot is already added.")
      return
    }
    setAssignError(null)
    setAssignSuccess(null)
    setAssignSlots((prev) => [...prev, { date: assignDate, time: assignTime }])
    setAssignTime("")
  }, [assignBookedTimesForSelectedDate, assignDate, assignPackageId, assignSlots, assignTime])

  const removeAssignSlot = React.useCallback((index: number) => {
    setAssignSlots((prev) => prev.filter((_, idx) => idx !== index))
  }, [])

  const submitAssignClasses = React.useCallback(async () => {
    if (!assignPackageId) {
      setAssignError("Select a package.")
      return
    }
    const cleaned = assignSlots
      .map((slot) => ({ date: slot.date.trim(), time: slot.time.trim() }))
      .filter((slot) => slot.date && slot.time)
    if (!cleaned.length) {
      setAssignError("Add at least one class to assign.")
      return
    }

    setAssigning(true)
    setAssignError(null)
    setAssignSuccess(null)
    try {
      const res = await fetch("/api/profile/bookings/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePurchaseId: assignPackageId,
          assignments: cleaned,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setAssignError(data?.error || "Unable to assign package classes.")
        return
      }
      setAssignSuccess("Package classes assigned successfully.")
      setAssignSlots([])
      setAssignDate("")
      setAssignTime("")
      setAssignAvailability([])
      clearAvailabilityCache()
      await Promise.all([loadBookings(), loadPointsHistory(), loadActionRequests()])
    } catch {
      setAssignError("Unable to assign package classes.")
    } finally {
      setAssigning(false)
    }
  }, [assignPackageId, assignSlots, clearAvailabilityCache, loadActionRequests, loadBookings, loadPointsHistory])

  React.useEffect(() => {
    setAssignSlots([])
    setAssignDate("")
    setAssignTime("")
    setAssignAvailability([])
    setAssignError(null)
    setAssignSuccess(null)
  }, [assignPackageId])

  React.useEffect(() => {
    if (!assignDate || !selectedPackageForAssign?.courseSlug) {
      setAssignAvailability([])
      return
    }
    void loadAssignAvailability(selectedPackageForAssign.courseSlug, assignDate)
  }, [assignDate, selectedPackageForAssign?.courseSlug, loadAssignAvailability])

  React.useEffect(() => {
    if (!assignTime) return
    const validSelection = assignAvailability.some(
      (slot) => slot.time === assignTime && !slot.isFull && !slot.isPast && !assignBookedTimesForSelectedDate.has(slot.time)
    )
    if (!validSelection) {
      setAssignTime("")
    }
  }, [assignAvailability, assignBookedTimesForSelectedDate, assignTime])

  React.useEffect(() => {
    if (!assignDate) return
    if (assignUnavailableDates.includes(assignDate)) {
      const scheduleTimes = selectedPackageForAssign?.courseSlug
        ? getAvailableTimesForCourseDate(selectedPackageForAssign.courseSlug, assignDate, sourceCourses)
        : []
      const allTimesPast =
        scheduleTimes.length > 0 && scheduleTimes.every((time) => isSlotInPastForTimeZone(assignDate, time, NY_TIMEZONE))
      setAssignDate("")
      setAssignTime("")
      setAssignAvailability([])
      setAssignError(allTimesPast ? "The time slots for that day have already passed." : "That date is already fully booked by you.")
    }
  }, [assignDate, assignUnavailableDates, selectedPackageForAssign?.courseSlug, sourceCourses])

  return {
    assignDate,
    setAssignDate,
    assignTime,
    setAssignTime,
    assignAvailability,
    assignAvailabilityLoading,
    assignSlots,
    assigning,
    assignError,
    setAssignError,
    assignSuccess,
    setAssignSuccess,
    selectedPackageForAssign,
    selectedPackageCourse,
    selectedPackageAssignmentStats,
    assignUnavailableDates,
    assignBookedTimesForSelectedDate,
    addAssignSlot,
    removeAssignSlot,
    submitAssignClasses,
  }
}
