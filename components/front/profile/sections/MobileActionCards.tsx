import React from "react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import type { ActionRequestItem, ActionRequestType, BookingItem } from "../profile-types"
import { RecentRequestsList } from "./RecentRequestsList"

type MobileActionCardsProps = {
  onOpenCoursePicker: () => void
  onOpenChangeClassModal: () => void
  onOpenRequestModal: (type: ActionRequestType) => void
  selectedBooking: BookingItem | null
  bookingsLoading: boolean
  bookingsError: string | null
  requestSubmitError: string | null
  requestSubmitSuccess: string | null
  requestModalType: ActionRequestType | null
  actionRequestsError: string | null
  actionRequestsLoading: boolean
  latestActionRequests: ActionRequestItem[]
}

export function MobileActionCards({
  onOpenCoursePicker,
  onOpenChangeClassModal,
  onOpenRequestModal,
  selectedBooking,
  bookingsLoading,
  bookingsError,
  requestSubmitError,
  requestSubmitSuccess,
  requestModalType,
  actionRequestsError,
  actionRequestsLoading,
  latestActionRequests,
}: MobileActionCardsProps) {
  return (
    <section className="order-[1.75] flex flex-col gap-4 lg:hidden">
      {/* Book + Change — same layout as Suspend / Cancel */}
      <GlassyCard className="p-4">
        <h3 className="text-base font-semibold">Book / Change class</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">
          {bookingsLoading
            ? "Loading next class..."
            : selectedBooking
              ? `Next: ${selectedBooking.courseTitle}`
              : "Schedule a new class or change an existing one."}
        </p>
        {bookingsError && <p className="mt-2 text-xs text-red-400">{bookingsError}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-md bg-[var(--brand,#b61616)] px-3 py-2 text-sm font-semibold text-white"
            onClick={onOpenCoursePicker}
          >
            Book new class
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--brand,#b61616)]/50 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-white/80"
            onClick={onOpenChangeClassModal}
            disabled={!selectedBooking}
          >
            Change class
          </button>
        </div>
      </GlassyCard>

      {/* Suspend / Cancel card */}
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

      {/* Recent requests card */}
      <GlassyCard className="p-4">
        <h3 className="text-base font-semibold">Recent requests</h3>
        <RecentRequestsList
          loading={actionRequestsLoading}
          error={actionRequestsError}
          requests={latestActionRequests}
        />
      </GlassyCard>
    </section>
  )
}
