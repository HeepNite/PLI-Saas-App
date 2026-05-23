import React from "react"
import type { AssignablePackage, BookingItem } from "../profile-types"

export type ProfileBookingsState = {
  bookings: BookingItem[]
  assignablePackages: AssignablePackage[]
  bookingsLoading: boolean
  bookingsError: string | null
  checkInSubmittingId: string | null
  checkInError: string | null
  checkInSuccess: string | null
  setCheckInSuccess: React.Dispatch<React.SetStateAction<string | null>>
  loadBookings: () => Promise<{ bookings: BookingItem[]; packages: AssignablePackage[] } | null | undefined>
  submitBookingCheckIn: (attendanceId: string) => Promise<void>
}

type UseProfileBookingsParams = {
  canLoadProtectedData: boolean
  clearAvailabilityCache: () => void
  loadPointsHistory: () => Promise<void>
  setSelectedBookingId: React.Dispatch<React.SetStateAction<string>>
  setAssignPackageId: React.Dispatch<React.SetStateAction<string>>
}

export function useProfileBookings({
  canLoadProtectedData,
  clearAvailabilityCache,
  loadPointsHistory,
  setSelectedBookingId,
  setAssignPackageId,
}: UseProfileBookingsParams): ProfileBookingsState {
  const [bookings, setBookings] = React.useState<BookingItem[]>([])
  const [assignablePackages, setAssignablePackages] = React.useState<AssignablePackage[]>([])
  const [bookingsLoading, setBookingsLoading] = React.useState(false)
  const [bookingsError, setBookingsError] = React.useState<string | null>(null)
  const [checkInSubmittingId, setCheckInSubmittingId] = React.useState<string | null>(null)
  const [checkInError, setCheckInError] = React.useState<string | null>(null)
  const [checkInSuccess, setCheckInSuccess] = React.useState<string | null>(null)

  const loadBookings = React.useCallback(async () => {
    if (!canLoadProtectedData) return
    setBookingsLoading(true)
    setBookingsError(null)
    try {
      const res = await fetch("/api/profile/bookings")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setBookingsError(data?.error || "Unable to load your scheduled classes.")
        return
      }
      clearAvailabilityCache()
      const bookingsData = Array.isArray(data?.bookings) ? (data.bookings as BookingItem[]) : []
      const packagesData = Array.isArray(data?.packages) ? (data.packages as AssignablePackage[]) : []
      setBookings(bookingsData)
      setAssignablePackages(packagesData)
      if (bookingsData.length > 0) {
        setSelectedBookingId((prev) => (prev && bookingsData.some((item) => item.id === prev) ? prev : bookingsData[0].id))
      } else {
        setSelectedBookingId("")
      }
      setAssignPackageId((prev) => (prev && packagesData.some((item) => item.id === prev) ? prev : packagesData[0]?.id || ""))
      return { bookings: bookingsData, packages: packagesData }
    } catch {
      setBookingsError("Unable to load your scheduled classes.")
      return null
    } finally {
      setBookingsLoading(false)
    }
  }, [canLoadProtectedData, clearAvailabilityCache, setAssignPackageId, setSelectedBookingId])

  const submitBookingCheckIn = React.useCallback(
    async (attendanceId: string) => {
      if (!attendanceId) return
      setCheckInSubmittingId(attendanceId)
      setCheckInError(null)
      setCheckInSuccess(null)
      try {
        const res = await fetch("/api/profile/bookings/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendanceId }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setCheckInError(data?.error || "Could not register your check-in.")
          return
        }

        const alreadyCheckedIn = Boolean(data?.alreadyCheckedIn)
        const pointsAwarded = typeof data?.points?.awarded === "number" ? data.points.awarded : 0
        const milestone = typeof data?.points?.milestone === "number" ? data.points.milestone : null
        let message = alreadyCheckedIn ? "This class was already marked as checked in." : "Check-in recorded successfully."
        if (!alreadyCheckedIn && pointsAwarded > 0) {
          message += ` +${pointsAwarded} points`
          if (milestone) message += ` (milestone ${milestone})`
          message += "."
        }
        setCheckInSuccess(message)
        await Promise.all([loadBookings(), loadPointsHistory()])
      } catch {
        setCheckInError("Could not register your check-in.")
      } finally {
        setCheckInSubmittingId(null)
      }
    },
    [loadBookings, loadPointsHistory]
  )

  return {
    bookings,
    assignablePackages,
    bookingsLoading,
    bookingsError,
    checkInSubmittingId,
    checkInError,
    checkInSuccess,
    setCheckInSuccess,
    loadBookings,
    submitBookingCheckIn,
  }
}
