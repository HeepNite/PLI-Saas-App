import React from "react"

type RoomReservationRow = {
  id: string
  roomId: string
  title: string
  reason: string
  category: string | null
  startsAt: string
  endsAt: string
  status: string
  assignedStaffClerkUserId: string | null
  cancellationReason: string | null
}

type RoomLookupItem = {
  name: string
}

type StaffRoomReservationListProps = {
  schoolLoading: boolean
  reservations: RoomReservationRow[]
  roomById: Record<string, RoomLookupItem>
  roomReservationBusyId: string | null
  onCancel: (reservation: RoomReservationRow) => void
  formatDateTime: (value: string | number | null | undefined) => string
  resolveAssignedStaffLabel: (staffId: string | null) => string
}

export default function StaffRoomReservationList({
  schoolLoading,
  reservations,
  roomById,
  roomReservationBusyId,
  onCancel,
  formatDateTime,
  resolveAssignedStaffLabel,
}: StaffRoomReservationListProps) {
  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Current / upcoming</p>
      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {schoolLoading ? (
          <p className="text-sm text-black/60 dark:text-white/60">Loading reservations...</p>
        ) : reservations.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No current or upcoming reservations.</p>
        ) : (
          reservations.map((item) => (
            <div key={`reservation-row-${item.id}`} className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-black dark:text-white">{item.title}</p>
                  <p className="text-xs text-black/65 dark:text-white/65">
                    {roomById[item.roomId]?.name || "Unknown room"} · {formatDateTime(item.startsAt)} → {formatDateTime(item.endsAt)}
                  </p>
                  <p className="mt-1 text-xs text-black/60 dark:text-white/60">Assigned: {resolveAssignedStaffLabel(item.assignedStaffClerkUserId)}</p>
                  <p className="mt-1 text-xs text-black/60 dark:text-white/60">Status: {item.status}</p>
                </div>
                {item.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => onCancel(item)}
                    disabled={roomReservationBusyId === item.id}
                    className="rounded border border-[var(--brand,#b61616)]/55 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] transition disabled:opacity-45"
                  >
                    {roomReservationBusyId === item.id ? "Cancelling..." : "Cancel"}
                  </button>
                ) : null}
              </div>
              {item.cancellationReason ? (
                <p className="mt-2 rounded-md border border-black/10 bg-black/[0.03] px-2.5 py-1.5 text-xs text-black/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
                  Cancellation reason: {item.cancellationReason}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
