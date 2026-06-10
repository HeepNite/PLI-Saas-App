import React from "react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import { formatDateTimeInTimeZone } from "../profile-formatters"
import type { ActionRequestItem, ActionRequestType, BookingItem } from "../profile-types"
import { RecentRequestsList } from "./RecentRequestsList"

type ProfileRightRailProps = {
  rightRailRef: React.RefObject<HTMLDivElement | null>
  bookingsLoading: boolean
  selectedBooking: BookingItem | null
  bookingsError: string | null
  onOpenCoursePicker: () => void
  onOpenChangeClassModal: () => void
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
  onOpenRequestModal,
  requestSubmitError,
  requestSubmitSuccess,
  requestModalType,
  actionRequestsError,
  actionRequestsLoading,
  latestActionRequests,
}: ProfileRightRailProps) {
  return (
    <aside className="hidden lg:block lg:w-[15rem] lg:justify-self-end lg:self-start">
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
          <RecentRequestsList
            loading={actionRequestsLoading}
            error={actionRequestsError}
            requests={latestActionRequests}
          />
        </GlassyCard>
      </div>
    </aside>
  )
}
