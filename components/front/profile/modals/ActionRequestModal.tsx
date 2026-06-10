import React from "react"
import { X } from "lucide-react"
import { formatDateTimeInTimeZone } from "../profile-formatters"
import type { ActionRequestType, AssignablePackage, BookingItem } from "../profile-types"

type ActionRequestModalProps = {
  requestModalType: ActionRequestType | null
  closeRequestModal: () => void
  requestSuspendPackageId: string
  setRequestSuspendPackageId: (value: string) => void
  suspendablePackages: AssignablePackage[]
  requestSuspendStart: string
  setRequestSuspendStart: (value: string) => void
  requestSuspendEnd: string
  setRequestSuspendEnd: (value: string) => void
  requestCancelBookingId: string
  setRequestCancelBookingId: (value: string) => void
  setRequestCancelDecision: (value: "REASSIGN" | "REFUND" | null) => void
  setRequestSubmitError: (value: string | null) => void
  visibleBookings: BookingItem[]
  requestCancelBooking: BookingItem | null
  requestCancelDecision: "REASSIGN" | "REFUND" | null
  requestMessage: string
  setRequestMessage: (value: string) => void
  requestSubmitError: string | null
  submitActionRequest: () => void
  requestSubmitting: boolean
}

export function ActionRequestModal({
  requestModalType,
  closeRequestModal,
  requestSuspendPackageId,
  setRequestSuspendPackageId,
  suspendablePackages,
  requestSuspendStart,
  setRequestSuspendStart,
  requestSuspendEnd,
  setRequestSuspendEnd,
  requestCancelBookingId,
  setRequestCancelBookingId,
  setRequestCancelDecision,
  setRequestSubmitError,
  visibleBookings,
  requestCancelBooking,
  requestCancelDecision,
  requestMessage,
  setRequestMessage,
  requestSubmitError,
  submitActionRequest,
  requestSubmitting,
}: ActionRequestModalProps) {
  if (!requestModalType) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" data-lenis-prevent>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-br from-[#16121a] via-[#0e0c13] to-[#09090d] p-5 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.85)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Request</p>
            <h3 className="mt-2 text-lg font-semibold text-white">{requestModalType === "SUSPEND" ? "Suspend package" : "Cancel class"}</h3>
            <p className="mt-1 text-sm text-white/60">
              {requestModalType === "SUSPEND"
                ? "Suspension applies only to active packages."
                : "Choose the class and decide if you want to reassign or request a refund."}
            </p>
          </div>
          <button
            type="button"
            onClick={closeRequestModal}
            className="rounded-full border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {requestModalType === "SUSPEND" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-white">Package</label>
                <select
                  value={requestSuspendPackageId}
                  onChange={(event) => setRequestSuspendPackageId(event.target.value)}
                  className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select a package</option>
                  {suspendablePackages.map((pkg) => (
                    <option key={`suspend-package-${pkg.id}`} value={pkg.id}>
                      {pkg.label} {pkg.isUnlimited ? "(Unlimited)" : `(${pkg.remainingCredits ?? 0} credits)`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-white">Suspension start</label>
                  <input
                    type="date"
                    value={requestSuspendStart}
                    onChange={(event) => setRequestSuspendStart(event.target.value)}
                    className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-white">Suspension end</label>
                  <input
                    type="date"
                    value={requestSuspendEnd}
                    onChange={(event) => setRequestSuspendEnd(event.target.value)}
                    min={requestSuspendStart || undefined}
                    className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {requestModalType === "CANCEL" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-white">Assigned class</label>
                <select
                  value={requestCancelBookingId}
                  onChange={(event) => {
                    setRequestCancelBookingId(event.target.value)
                    setRequestCancelDecision(null)
                    setRequestSubmitError(null)
                  }}
                  className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select a class</option>
                  {visibleBookings.map((booking) => (
                    <option key={`cancel-booking-${booking.id}`} value={booking.id}>
                      {booking.courseTitle} · {formatDateTimeInTimeZone(booking.startsAt)}
                    </option>
                  ))}
                </select>
              </div>
              {requestCancelBooking && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                  <p className="font-semibold text-white">{requestCancelBooking.courseTitle}</p>
                  <p className="mt-1 text-xs text-white/65">{formatDateTimeInTimeZone(requestCancelBooking.startsAt)}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-white">Do you want to reassign this class?</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRequestCancelDecision("REASSIGN")
                      setRequestSubmitError(null)
                    }}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      requestCancelDecision === "REASSIGN"
                        ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.2)] text-white"
                        : "border-white/15 text-white/80 hover:border-white/40"
                    }`}
                  >
                    Yes, reassign
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestCancelDecision("REFUND")
                      setRequestSubmitError(null)
                    }}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      requestCancelDecision === "REFUND"
                        ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.2)] text-white"
                        : "border-white/15 text-white/80 hover:border-white/40"
                    }`}
                  >
                    No, refund
                  </button>
                </div>
              </div>
            </div>
          )}

          <label className="text-sm font-medium text-white">Details (optional)</label>
          <textarea
            value={requestMessage}
            onChange={(event) => setRequestMessage(event.target.value)}
            rows={4}
            placeholder={
              requestModalType === "SUSPEND"
                ? "Ex: I am traveling for two weeks and resuming later."
                : requestCancelDecision === "REASSIGN"
                  ? "You can add context before moving to the change."
                  : "Ex: for now I will not continue."
            }
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/45"
          />
          {requestSubmitError && <p className="text-xs text-red-400">{requestSubmitError}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={closeRequestModal} className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80">
            Cancel
          </button>
          <button
            type="button"
            onClick={submitActionRequest}
            disabled={requestSubmitting || (requestModalType === "CANCEL" && !requestCancelDecision)}
            className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {requestSubmitting ? "Processing..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  )
}
