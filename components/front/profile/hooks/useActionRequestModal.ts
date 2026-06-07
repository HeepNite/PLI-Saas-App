import React from "react"
import type { ActionRequestType, AssignablePackage, BookingItem } from "../profile-types"
import { actionRequestLabels, NY_TIMEZONE } from "../profile-constants"
import { addDaysToIsoDate, formatDateKeyInTimeZone } from "../profile-formatters"

type UseActionRequestModalParams = {
  suspendablePackages: AssignablePackage[]
  visibleBookings: BookingItem[]
  selectedBooking: BookingItem | null
  loadActionRequests: () => Promise<void>
  openChangeClassModalForBooking: (bookingId: string) => boolean
}

export type ActionRequestModalState = {
  requestModalType: ActionRequestType | null
  requestMessage: string
  setRequestMessage: React.Dispatch<React.SetStateAction<string>>
  requestSuspendStart: string
  setRequestSuspendStart: React.Dispatch<React.SetStateAction<string>>
  requestSuspendEnd: string
  setRequestSuspendEnd: React.Dispatch<React.SetStateAction<string>>
  requestSuspendPackageId: string
  setRequestSuspendPackageId: React.Dispatch<React.SetStateAction<string>>
  requestCancelEffectiveDate: string
  setRequestCancelEffectiveDate: React.Dispatch<React.SetStateAction<string>>
  requestCancelBookingId: string
  setRequestCancelBookingId: React.Dispatch<React.SetStateAction<string>>
  requestCancelDecision: "REASSIGN" | "REFUND" | null
  setRequestCancelDecision: React.Dispatch<React.SetStateAction<"REASSIGN" | "REFUND" | null>>
  requestSubmitting: boolean
  requestSubmitError: string | null
  setRequestSubmitError: React.Dispatch<React.SetStateAction<string | null>>
  requestSubmitSuccess: string | null
  requestCancelBooking: BookingItem | null
  openRequestModal: (type: ActionRequestType) => void
  closeRequestModal: () => void
  submitActionRequest: () => Promise<void>
}

export function useActionRequestModal({
  suspendablePackages,
  visibleBookings,
  selectedBooking,
  loadActionRequests,
  openChangeClassModalForBooking,
}: UseActionRequestModalParams): ActionRequestModalState {
  const [requestModalType, setRequestModalType] = React.useState<ActionRequestType | null>(null)
  const [requestMessage, setRequestMessage] = React.useState("")
  const [requestSuspendStart, setRequestSuspendStart] = React.useState("")
  const [requestSuspendEnd, setRequestSuspendEnd] = React.useState("")
  const [requestSuspendPackageId, setRequestSuspendPackageId] = React.useState("")
  const [requestCancelEffectiveDate, setRequestCancelEffectiveDate] = React.useState("")
  const [requestCancelBookingId, setRequestCancelBookingId] = React.useState("")
  const [requestCancelDecision, setRequestCancelDecision] = React.useState<"REASSIGN" | "REFUND" | null>(null)
  const [requestSubmitting, setRequestSubmitting] = React.useState(false)
  const [requestSubmitError, setRequestSubmitError] = React.useState<string | null>(null)
  const [requestSubmitSuccess, setRequestSubmitSuccess] = React.useState<string | null>(null)

  const requestCancelBooking = React.useMemo(
    () => visibleBookings.find((item) => item.id === requestCancelBookingId) || null,
    [visibleBookings, requestCancelBookingId]
  )

  const openSuspendModal = React.useCallback(() => {
    if (!suspendablePackages.length) {
      setRequestSubmitError("You don't have active packages to suspend.")
      return
    }
    const today = formatDateKeyInTimeZone(new Date(), NY_TIMEZONE) || new Date().toISOString().slice(0, 10)
    setRequestModalType("SUSPEND")
    setRequestMessage("")
    setRequestSuspendStart(today)
    setRequestSuspendEnd(addDaysToIsoDate(today, 14))
    setRequestSuspendPackageId(suspendablePackages[0]?.id || "")
    setRequestCancelBookingId("")
    setRequestCancelDecision(null)
    setRequestCancelEffectiveDate("")
    setRequestSubmitError(null)
    setRequestSubmitSuccess(null)
  }, [suspendablePackages])

  const openCancelModal = React.useCallback(() => {
    if (!visibleBookings.length) {
      setRequestSubmitError("You don't have assigned classes available to cancel.")
      return
    }
    const booking = selectedBooking || visibleBookings[0]
    const effectiveDate = booking ? formatDateKeyInTimeZone(booking.startsAt, NY_TIMEZONE) : ""
    setRequestModalType("CANCEL")
    setRequestMessage("")
    setRequestCancelBookingId(booking?.id || "")
    setRequestCancelDecision(null)
    setRequestCancelEffectiveDate(effectiveDate)
    setRequestSuspendPackageId("")
    setRequestSuspendStart("")
    setRequestSuspendEnd("")
    setRequestSubmitError(null)
    setRequestSubmitSuccess(null)
  }, [selectedBooking, visibleBookings])

  const closeRequestModal = React.useCallback(() => {
    setRequestModalType(null)
    setRequestMessage("")
    setRequestSuspendStart("")
    setRequestSuspendEnd("")
    setRequestSuspendPackageId("")
    setRequestCancelEffectiveDate("")
    setRequestCancelBookingId("")
    setRequestCancelDecision(null)
    setRequestSubmitError(null)
  }, [])

  const submitActionRequest = React.useCallback(async () => {
    if (!requestModalType) return
    const message = requestMessage.trim()
    let meta: Record<string, unknown> | undefined

    if (requestModalType === "SUSPEND") {
      if (!requestSuspendPackageId) {
        setRequestSubmitError("Select a package to suspend.")
        return
      }
      if (!requestSuspendStart || !requestSuspendEnd) {
        setRequestSubmitError("Select start and end dates for the suspension.")
        return
      }
      if (requestSuspendEnd < requestSuspendStart) {
        setRequestSubmitError("End date cannot be earlier than start date.")
        return
      }
      meta = {
        startDate: requestSuspendStart,
        endDate: requestSuspendEnd,
        packagePurchaseId: requestSuspendPackageId,
      }
    }

    if (requestModalType === "CANCEL") {
      if (!requestCancelBookingId) {
        setRequestSubmitError("Select the class you want to cancel.")
        return
      }
      if (!requestCancelDecision) {
        setRequestSubmitError("Select whether you want to reassign or request a refund.")
        return
      }
      if (requestCancelDecision === "REASSIGN") {
        closeRequestModal()
        openChangeClassModalForBooking(requestCancelBookingId)
        return
      }
      const booking = visibleBookings.find((item) => item.id === requestCancelBookingId) || null
      if (!booking) {
        setRequestSubmitError("We couldn't find the selected class to cancel.")
        return
      }
      const effectiveDate = requestCancelEffectiveDate || formatDateKeyInTimeZone(booking.startsAt, NY_TIMEZONE)
      if (!effectiveDate) {
        setRequestSubmitError("We couldn't determine the effective date for cancellation.")
        return
      }
      meta = {
        effectiveDate,
        attendanceId: booking.id,
        refundRequested: true,
      }
    }

    setRequestSubmitting(true)
    setRequestSubmitError(null)
    try {
      const res = await fetch("/api/profile/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: requestModalType,
          message,
          meta,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setRequestSubmitError(data?.error || "Could not create the request.")
        return
      }
      setRequestSubmitSuccess(`${actionRequestLabels[requestModalType].toLowerCase()} request sent.`)
      closeRequestModal()
      await loadActionRequests()
    } catch {
      setRequestSubmitError("Could not create the request.")
    } finally {
      setRequestSubmitting(false)
    }
  }, [
    closeRequestModal,
    loadActionRequests,
    openChangeClassModalForBooking,
    requestCancelBookingId,
    requestCancelDecision,
    requestCancelEffectiveDate,
    requestMessage,
    requestModalType,
    requestSuspendEnd,
    requestSuspendPackageId,
    requestSuspendStart,
    visibleBookings,
  ])

  const openRequestModal = React.useCallback(
    (type: ActionRequestType) => {
      if (type === "SUSPEND") {
        openSuspendModal()
        return
      }
      if (type === "CANCEL") {
        openCancelModal()
        return
      }
      setRequestSubmitError("This request type is handled from 'Change class'.")
    },
    [openCancelModal, openSuspendModal]
  )

  React.useEffect(() => {
    if (!requestSubmitSuccess) return
    const id = window.setTimeout(() => setRequestSubmitSuccess(null), 3500)
    return () => window.clearTimeout(id)
  }, [requestSubmitSuccess])

  React.useEffect(() => {
    if (requestModalType !== "SUSPEND") return
    if (requestSuspendPackageId) return
    if (!suspendablePackages.length) return
    setRequestSuspendPackageId(suspendablePackages[0].id)
  }, [requestModalType, requestSuspendPackageId, suspendablePackages])

  React.useEffect(() => {
    if (requestModalType !== "CANCEL") return
    if (!requestCancelBookingId && visibleBookings.length > 0) {
      setRequestCancelBookingId(visibleBookings[0].id)
      return
    }
    if (!requestCancelBooking) return
    const nextEffectiveDate = formatDateKeyInTimeZone(requestCancelBooking.startsAt, NY_TIMEZONE)
    if (!nextEffectiveDate) return
    if (nextEffectiveDate !== requestCancelEffectiveDate) {
      setRequestCancelEffectiveDate(nextEffectiveDate)
    }
  }, [requestCancelBooking, requestCancelBookingId, requestCancelEffectiveDate, requestModalType, visibleBookings])

  return {
    requestModalType,
    requestMessage,
    setRequestMessage,
    requestSuspendStart,
    setRequestSuspendStart,
    requestSuspendEnd,
    setRequestSuspendEnd,
    requestSuspendPackageId,
    setRequestSuspendPackageId,
    requestCancelEffectiveDate,
    setRequestCancelEffectiveDate,
    requestCancelBookingId,
    setRequestCancelBookingId,
    requestCancelDecision,
    setRequestCancelDecision,
    requestSubmitting,
    requestSubmitError,
    setRequestSubmitError,
    requestSubmitSuccess,
    requestCancelBooking,
    openRequestModal,
    closeRequestModal,
    submitActionRequest,
  }
}
