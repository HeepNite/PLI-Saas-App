import React from "react"
import { Search } from "lucide-react"

import type { RoomRow } from "./staffAdminTypes"

type RoomFormState = {
  id: string
  name: string
  capacity: string
  location: string
  active: boolean
}

type RoomStatusFilter = "all" | "active" | "inactive"

type RoomDisableActionState = {
  disabled: boolean
  label: string
}

type StaffSchoolRoomsPanelProps = {
  visible: boolean
  wizard: {
    step: number
    totalSteps: number
    onPrevious: () => void
    onNext: () => void
  }
  form: {
    roomForm: RoomFormState
    updateRoomFormField: (field: keyof RoomFormState, value: string | boolean) => void
    onSaveRoom: (event: React.FormEvent<HTMLFormElement>) => void
    resetRoomForm: () => void
    roomSaving: boolean
    roomFormError: string | null
    roomFormSuccess: string | null
  }
  filters: {
    roomSearchQuery: string
    setRoomSearchQuery: (value: string) => void
    roomStatusFilter: RoomStatusFilter
    setRoomStatusFilter: (value: RoomStatusFilter) => void
  }
  data: {
    schoolLoading: boolean
    visibleRooms: RoomRow[]
    activeRoomOptions: RoomRow[]
    roomBusyId: string | null
    roomActionErrors: Record<string, string | undefined>
  }
  actions: {
    loadRoomIntoForm: (room: RoomRow) => void
    activateRoom: (roomId: string) => Promise<void>
    disableRoom: (roomId: string) => Promise<void>
    openRoomReassignModal: (room: RoomRow) => void
    openRoomSafeDeleteModal: (room: RoomRow) => void
    resolveRoomDisableActionState: (room: RoomRow, roomBusyId: string | null) => RoomDisableActionState
  }
}

export default function StaffSchoolRoomsPanel({
  visible,
  wizard,
  form,
  filters,
  data,
  actions,
}: StaffSchoolRoomsPanelProps) {
  if (!visible) return null

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Room management</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Create, edit, lifecycle, and safe-delete rooms</h3>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Keep the room catalog clean so course defaults and session conflict checks stay reliable.
          </p>
        </div>
        <button
          type="button"
          onClick={form.resetRoomForm}
          className="inline-flex items-center justify-center rounded-md border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff4b4b)] dark:border-white/15 dark:bg-white/[0.04] dark:text-white/80"
        >
          New room
        </button>
      </header>

      <div className="mt-5 grid gap-5">
        <RoomForm form={form} />
        <RoomsList filters={filters} data={data} actions={actions} />
      </div>
      <WizardFooter wizard={wizard} />
    </article>
  )
}

function RoomForm({ form }: { form: StaffSchoolRoomsPanelProps["form"] }) {
  const { roomForm } = form

  return (
    <form onSubmit={form.onSaveRoom} className="space-y-3 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
          {roomForm.id ? "Editing room" : "Create room"}
        </p>
        <p className="mt-1 text-xs text-black/55 dark:text-white/55">
          Names must stay unique and capacity must be greater than zero.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(160px,1fr)_minmax(96px,130px)_minmax(130px,150px)_minmax(170px,1fr)]">
        <input
          name="roomName"
          value={roomForm.name}
          onChange={(event) => form.updateRoomFormField("name", event.target.value)}
          placeholder="Room name"
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          required
        />
        <input
          name="roomCapacity"
          type="number"
          min={1}
          value={roomForm.capacity}
          onChange={(event) => form.updateRoomFormField("capacity", event.target.value)}
          placeholder="Capacity"
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          required
        />
        <label className="inline-flex h-full items-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs text-black/75 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/75">
          <input
            type="checkbox"
            checked={roomForm.active}
            onChange={(event) => form.updateRoomFormField("active", event.target.checked)}
          />
          Active room
        </label>
        <input
          name="roomLocation"
          value={roomForm.location}
          onChange={(event) => form.updateRoomFormField("location", event.target.value)}
          placeholder="Location details (optional)"
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
      </div>
      {form.roomFormError ? <p className="rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">{form.roomFormError}</p> : null}
      {form.roomFormSuccess ? <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{form.roomFormSuccess}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={form.resetRoomForm} disabled={form.roomSaving} className="inline-flex w-full items-center justify-center rounded-md border border-black/20 bg-white px-4 py-2 text-sm font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-60 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80">Reset</button>
        <button type="submit" disabled={form.roomSaving} className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60">
          {form.roomSaving ? "Saving..." : roomForm.id ? "Update room" : "Create room"}
        </button>
      </div>
    </form>
  )
}

function RoomsList({ filters, data, actions }: Pick<StaffSchoolRoomsPanelProps, "filters" | "data" | "actions">) {
  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45 dark:text-white/45" />
          <input value={filters.roomSearchQuery} onChange={(event) => filters.setRoomSearchQuery(event.target.value)} placeholder="Search by room or location" className="w-full rounded-md border border-black/15 bg-white py-2 pl-9 pr-3 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" />
        </div>
        <select
          value={filters.roomStatusFilter}
          onChange={(event) => filters.setRoomStatusFilter(resolveRoomStatusFilter(event.target.value))}
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {data.schoolLoading ? <RoomLoadingSkeleton /> : null}
        {!data.schoolLoading && data.visibleRooms.length === 0 ? <p className="text-sm text-black/60 dark:text-white/60">No rooms match the current filters.</p> : null}
        {!data.schoolLoading ? data.visibleRooms.map((room) => <RoomListItem key={`room-row-${room.id}`} room={room} data={data} actions={actions} />) : null}
      </div>
    </div>
  )
}

function RoomListItem({ room, data, actions }: { room: RoomRow; data: StaffSchoolRoomsPanelProps["data"]; actions: StaffSchoolRoomsPanelProps["actions"] }) {
  const disableAction = actions.resolveRoomDisableActionState(room, data.roomBusyId)
  const canReassign = data.activeRoomOptions.filter((option) => option.id !== room.id).length > 0
  const actionError = data.roomActionErrors[room.id]

  return (
    <div className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-black dark:text-white">{room.name}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${room.active ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-black/15 bg-black/[0.04] text-black/60 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/60"}`}>{room.active ? "Active" : "Inactive"}</span>
          </div>
          <p className="mt-1 text-xs text-black/65 dark:text-white/65">Capacity {room.capacity} · {room.location || "No location detail"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => actions.loadRoomIntoForm(room)} className="rounded border border-[var(--brand,#b61616)]/60 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)]">Edit</button>
          {!room.active ? <button type="button" onClick={() => void actions.activateRoom(room.id)} disabled={data.roomBusyId === room.id} className="rounded border border-emerald-500/35 px-2 py-1 text-[11px] font-semibold text-emerald-300 transition disabled:cursor-not-allowed disabled:opacity-45">{data.roomBusyId === room.id ? "Activating..." : "Activate"}</button> : null}
          <button type="button" onClick={() => void actions.disableRoom(room.id)} disabled={disableAction.disabled} className="rounded border border-black/15 px-2 py-1 text-[11px] font-semibold text-black/75 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff4b4b)] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white/75">{disableAction.label}</button>
          <button type="button" onClick={() => actions.openRoomReassignModal(room)} disabled={data.roomBusyId === room.id || !canReassign} className="rounded border border-black/15 px-2 py-1 text-[11px] font-semibold text-black/75 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff4b4b)] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white/75">Reassign</button>
          {!room.active ? <button type="button" onClick={() => actions.openRoomSafeDeleteModal(room)} disabled={data.roomBusyId === room.id} className="rounded border border-[var(--brand,#b61616)]/55 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] transition disabled:cursor-not-allowed disabled:opacity-45">{data.roomBusyId === room.id ? "Deleting..." : "Safe delete"}</button> : null}
        </div>
      </div>
      {actionError ? <p className="mt-2 rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-2.5 py-2 text-xs text-[var(--brand,#ff4b4b)]">{actionError}</p> : null}
    </div>
  )
}

function RoomLoadingSkeleton() {
  return <div className="space-y-2 animate-pulse"><div className="h-20 rounded-md bg-black/10 dark:bg-white/10" /><div className="h-20 rounded-md bg-black/10 dark:bg-white/10" /><div className="h-20 rounded-md bg-black/10 dark:bg-white/10" /></div>
}

function WizardFooter({ wizard }: { wizard: StaffSchoolRoomsPanelProps["wizard"] }) {
  return <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10"><button type="button" onClick={wizard.onPrevious} disabled={wizard.step === 0} className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]">← Previous</button><span className="text-[10px] text-black/40 dark:text-white/40">Step {wizard.step + 1} of {wizard.totalSteps}</span><button type="button" onClick={wizard.onNext} disabled={wizard.step >= wizard.totalSteps - 1} className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30">Next →</button></div>
}

function resolveRoomStatusFilter(value: string): RoomStatusFilter {
  if (value === "active" || value === "inactive") return value
  return "all"
}
