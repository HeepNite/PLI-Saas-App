import React from "react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import { CHECK_IN_OPEN_WINDOW_HOURS, actionRequestLabels } from "../profile-constants"
import {
  actionRequestMetaLabel,
  actionRequestStatusLabel,
  formatDateTimeInTimeZone,
  getProcessTypeTone,
} from "../profile-formatters"
import type { ActionRequestItem, ActionRequestType, BookingItem } from "../profile-types"

type ProfileRightRailProps = {
  rightRailRef: React.RefObject<HTMLDivElement | null>
  bookingsLoading: boolean
  selectedBooking: BookingItem | null
  bookingsError: string | null
  onOpenCoursePicker: () => void
  onOpenChangeClassModal: () => void
  nextCheckInBooking: BookingItem | null
  pendingCheckInBooking: BookingItem | null
  checkInOpensAtLabel: string
  checkInSubmittingId: string | null
  checkInError: string | null
  checkInSuccess: string | null
  onSubmitBookingCheckIn: (bookingId: string) => void
  onOpenRequestModal: (type: ActionRequestType) => void
  requestSubmitError: string | null
  requestSubmitSuccess: string | null
  requestModalType: ActionRequestType | null
  actionRequestsError: string | null
  actionRequestsLoading: boolean
  latestActionRequests: ActionRequestItem[]
}

export function ProfileRightRail({
  rightRailRef,
  bookingsLoading,
  selectedBooking,
  bookingsError,
  onOpenCoursePicker,
  onOpenChangeClassModal,
  nextCheckInBooking,
  pendingCheckInBooking,
  checkInOpensAtLabel,
  checkInSubmittingId,
  checkInError,
  checkInSuccess,
  onSubmitBookingCheckIn,
  onOpenRequestModal,
  requestSubmitError,
  requestSubmitSuccess,
  requestModalType,
  actionRequestsError,
  actionRequestsLoading,
  latestActionRequests,
}: ProfileRightRailProps) {
  return (
    <aside className="lg:w-[15rem] lg:justify-self-end lg:self-start">
      <div ref={rightRailRef} className="profile-right-rail space-y-4">
        <GlassyCard className="p-4">
          <h3 className="text-base font-semibold">Book new class</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">Schedule a new class available in your time slot.</p>
          <button
            className="mt-4 w-full rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white"
            onClick={onOpenCoursePicker}
          >
            Book
          </button>
        </GlassyCard>
        <GlassyCard className="p-4">
          <h3 className="text-base font-semibold">Change class</h3>
          {bookingsLoading ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">Loading next class...</p>
          ) : selectedBooking ? (
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-zinc-800 dark:text-white/80">{selectedBooking.courseTitle}</p>
              <p className="text-zinc-600 dark:text-white/60">
                {formatDateTimeInTimeZone(selectedBooking.startsAt)}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">You do not have a scheduled class to change.</p>
          )}
          {bookingsError && <p className="mt-2 text-xs text-red-400">{bookingsError}</p>}
          <button
            type="button"
            className="mt-4 w-full rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-white/10 dark:text-white/80"
            onClick={onOpenChangeClassModal}
            disabled={!selectedBooking}
          >
            Change
          </button>
        </GlassyCard>
        <GlassyCard className="p-4">
          <h3 className="text-base font-semibold">Check-in</h3>
          {bookingsLoading ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">Loading classes...</p>
          ) : nextCheckInBooking ? (
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-zinc-800 dark:text-white/80">{nextCheckInBooking.courseTitle}</p>
              <p className="text-zinc-600 dark:text-white/60">
                {formatDateTimeInTimeZone(nextCheckInBooking.startsAt)}
              </p>
            </div>
          ) : pendingCheckInBooking ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">
              Check-in opens {CHECK_IN_OPEN_WINDOW_HOURS} hours before.
              {checkInOpensAtLabel ? ` Available from ${checkInOpensAtLabel}.` : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">
              You do not have pending classes to check in.
            </p>
          )}
          <button
            type="button"
            className="mt-4 w-full rounded-md border border-[var(--brand,#b61616)]/50 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60 dark:text-white/80"
            onClick={() => {
              if (!nextCheckInBooking) return
              onSubmitBookingCheckIn(nextCheckInBooking.id)
            }}
            disabled={!nextCheckInBooking || Boolean(checkInSubmittingId)}
          >
            {checkInSubmittingId === nextCheckInBooking?.id ? "Recording..." : "Mark check-in"}
          </button>
          {checkInError && <p className="mt-2 text-xs text-red-400">{checkInError}</p>}
          {checkInSuccess && <p className="mt-2 text-xs text-emerald-500 dark:text-emerald-300">{checkInSuccess}</p>}
        </GlassyCard>
        <GlassyCard className="p-4">
          <h3 className="text-base font-semibold">Suspend / Cancel</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">
            Cancellation: choose a class and decide whether to reassign or request a refund.
            Suspension: only for active packages.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-zinc-700 dark:border-white/10 dark:text-white/80"
              onClick={() => onOpenRequestModal("SUSPEND")}
            >
              Suspend package
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--brand,#b61616)]/50 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-white/80"
              onClick={() => onOpenRequestModal("CANCEL")}
            >
              Cancel class
            </button>
          </div>
          {requestSubmitError && !requestModalType && (
            <p className="mt-3 text-xs text-red-400">{requestSubmitError}</p>
          )}
          {requestSubmitSuccess && (
            <p className="mt-3 text-xs text-emerald-500 dark:text-emerald-300">{requestSubmitSuccess}</p>
          )}
        </GlassyCard>
        <GlassyCard className="p-4">
          <h3 className="text-base font-semibold">Recent requests</h3>
          {actionRequestsError && <p className="mt-2 text-xs text-red-400">{actionRequestsError}</p>}
          {actionRequestsLoading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`request-skeleton-${idx}`} className="h-14 animate-pulse rounded-lg border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : latestActionRequests.length > 0 ? (
            <div className="mt-3 space-y-2">
              {latestActionRequests.map((request) => {
                const metaLabel = actionRequestMetaLabel(request)
                const tone = getProcessTypeTone(request.type)
                return (
                  <div
                    key={request.id}
                    className="rounded-lg border px-3 py-2"
                    style={{ borderColor: tone.border, background: tone.bg }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-800 dark:text-white/85">
                        {actionRequestLabels[request.type as ActionRequestType] || request.type}
                      </p>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
                        style={{ borderColor: tone.border, color: tone.text }}
                      >
                        {actionRequestStatusLabel(request.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-white/55">
                      {formatDateTimeInTimeZone(request.createdAt)}
                    </p>
                    {metaLabel && <p className="mt-1 text-xs text-zinc-700 dark:text-white/70">{metaLabel}</p>}
                    {request.message && (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-700 dark:text-white/70">{request.message}</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-600 dark:text-white/60">No requests for now.</p>
          )}
        </GlassyCard>
      </div>
    </aside>
  )
}
