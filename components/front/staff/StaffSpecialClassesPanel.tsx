"use client"

import React from "react"
import type { StaffRole } from "@/lib/security/staff-role"

type Summary = { id: string; slug: string; title: string; status: string; capacity: number; remaining: number; held: number; paid: number; checkedIn: number; session: { startsAt: string } }
type RosterItem = { id: string; name: string | null; email: string | null; phone: string | null; status: string; attendance: { id: string; status: string } | null }
type Detail = {
  id: string; title: string; description: string; status: string; priceCents: number; currency: string; coverImageUrl: string | null
  classSession: { startsAt: string; durationMinutes: number | null; location: string | null; capacity: number }
  metrics: { capacity: number; available: number; held: number; paid: number; checkedIn: number }; roster: RosterItem[]
}

const toLocalDateTimeInputValue = (value: string) => {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export default function StaffSpecialClassesPanel({ visible, currentRole }: { visible: boolean; currentRole: StaffRole }) {
  const [items, setItems] = React.useState<Summary[]>([])
  const [detail, setDetail] = React.useState<Detail | null>(null)
  const [message, setMessage] = React.useState("")
  const canManage = currentRole === "owner" || currentRole === "admin"
  const load = React.useCallback(async () => {
    const response = await fetch("/api/staff/special-classes", { cache: "no-store" })
    if (!response.ok) throw new Error("Unable to load special classes")
    const result = await response.json() as { items: Summary[] }
    setItems(result.items)
  }, [])
  React.useEffect(() => { if (visible) void load().catch((error) => setMessage(error.message)) }, [load, visible])
  if (!visible) return null

  const open = async (id: string) => {
    const response = await fetch(`/api/staff/special-classes/${id}`, { cache: "no-store" })
    const result = await response.json() as { item?: Detail; error?: string }
    if (!response.ok || !result.item) return setMessage(result.error || "Unable to load roster")
    setDetail(result.item)
  }
  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const response = await fetch("/api/staff/special-classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, capacity: Number(values.capacity), priceCents: Math.round(Number(values.price) * 100), durationMinutes: Number(values.durationMinutes) }) })
    const result = await response.json() as { error?: string }
    setMessage(response.ok ? "Special class draft created." : result.error || "Unable to create special class")
    if (response.ok) { event.currentTarget.reset(); await load() }
  }
  const setStatus = async (id: string, status: string) => {
    const response = await fetch(`/api/staff/special-classes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-correlation-id": crypto.randomUUID() }, body: JSON.stringify({ status }) })
    if (!response.ok) return setMessage((await response.json() as { error?: string }).error || "Unable to update class")
    await load(); await open(id)
  }
  const update = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!detail) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const response = await fetch(`/api/staff/special-classes/${detail.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-correlation-id": crypto.randomUUID() }, body: JSON.stringify({ ...values, capacity: Number(values.capacity), priceCents: Math.round(Number(values.price) * 100), durationMinutes: Number(values.durationMinutes) }) })
    const result = await response.json() as { error?: string }
    setMessage(response.ok ? "Special class updated." : result.error || "Unable to update special class")
    if (response.ok) { await load(); await open(detail.id) }
  }
  const attendanceAction = async (attendanceId: string, action: string) => {
    if (!detail) return
    const reason = action === "check_in" ? "" : window.prompt("Reason for this action")?.trim() || ""
    if (action !== "check_in" && !reason) return
    const response = await fetch(`/api/staff/special-classes/${detail.id}/roster/${attendanceId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason, idempotencyKey: crypto.randomUUID() }) })
    if (!response.ok) return setMessage((await response.json() as { error?: string }).error || "Unable to update attendance")
    await open(detail.id); await load()
  }

  return <section className="space-y-5 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950" aria-labelledby="special-classes-heading">
    <header><h2 id="special-classes-heading" className="text-2xl font-black">Special Classes</h2><p className="text-sm text-zinc-500">Canonical sessions, reservations, payments, and check-ins.</p></header>
    {message && <p role="status" className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">{message}</p>}
    {canManage && <form onSubmit={create} className="grid gap-2 rounded-xl border border-black/10 p-4 md:grid-cols-4 dark:border-white/10">
      {[["slug", "Slug"], ["title", "Title"], ["description", "Description"], ["startsAt", "Start date/time"], ["durationMinutes", "Duration minutes"], ["location", "Location"], ["capacity", "Capacity"], ["price", "Price"]].map(([name, label]) => <label key={name} className="grid gap-1 text-xs font-bold">{label}<input required name={name} type={name === "startsAt" ? "datetime-local" : ["durationMinutes", "capacity", "price"].includes(name) ? "number" : "text"} min={name === "price" ? "0.01" : "1"} step={name === "price" ? "0.01" : "1"} className="min-h-10 rounded border bg-transparent px-2" /></label>)}
      <input type="hidden" name="currency" value="usd" /><button className="min-h-10 self-end rounded bg-rose-600 px-4 font-bold text-white">Create draft</button>
    </form>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Class", "Status", "Start", "Capacity", "Available", "Held", "Paid", "Checked in", "Actions"].map((heading) => <th key={heading} className="p-2">{heading}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-2 font-bold">{item.title}</td><td>{item.status}</td><td>{new Date(item.session.startsAt).toLocaleString()}</td><td>{item.capacity}</td><td>{item.remaining}</td><td>{item.held}</td><td>{item.paid}</td><td>{item.checkedIn}</td><td className="space-x-2"><button onClick={() => void open(item.id)} className="underline">Details</button>{canManage && item.status === "draft" && <button onClick={() => void setStatus(item.id, "published")} className="underline">Publish</button>}{canManage && item.status === "published" && <><button onClick={() => void setStatus(item.id, "closed")} className="underline">Close sales</button><button onClick={() => void setStatus(item.id, "cancelled")} className="underline text-red-600">Cancel class</button></>}</td></tr>)}</tbody></table></div>
    {detail && <section className="rounded-xl border p-4"><h3 className="text-lg font-black">{detail.title} roster</h3><p className="text-sm">Capacity {detail.metrics.capacity} · Available {detail.metrics.available} · Held {detail.metrics.held} · Paid {detail.metrics.paid} · Checked in {detail.metrics.checkedIn}</p>{canManage && (detail.status === "draft" || detail.status === "published") && <details className="mt-4 rounded-lg border p-3"><summary className="cursor-pointer font-bold">Edit class definition</summary><form onSubmit={update} className="mt-3 grid gap-2 md:grid-cols-3"><label className="grid gap-1 text-xs font-bold">Title<input required name="title" defaultValue={detail.title} className="min-h-10 rounded border bg-transparent px-2" /></label><label className="grid gap-1 text-xs font-bold">Description<input required name="description" defaultValue={detail.description} className="min-h-10 rounded border bg-transparent px-2" /></label><label className="grid gap-1 text-xs font-bold">Start date/time<input required name="startsAt" type="datetime-local" defaultValue={toLocalDateTimeInputValue(detail.classSession.startsAt)} className="min-h-10 rounded border bg-transparent px-2" /></label><label className="grid gap-1 text-xs font-bold">Duration minutes<input required name="durationMinutes" type="number" min="1" defaultValue={detail.classSession.durationMinutes ?? 60} className="min-h-10 rounded border bg-transparent px-2" /></label><label className="grid gap-1 text-xs font-bold">Location<input name="location" defaultValue={detail.classSession.location ?? ""} className="min-h-10 rounded border bg-transparent px-2" /></label><label className="grid gap-1 text-xs font-bold">Capacity<input required name="capacity" type="number" min="1" defaultValue={detail.classSession.capacity} className="min-h-10 rounded border bg-transparent px-2" /></label><label className="grid gap-1 text-xs font-bold">Price<input required name="price" type="number" min="0.01" step="0.01" defaultValue={(detail.priceCents / 100).toFixed(2)} className="min-h-10 rounded border bg-transparent px-2" /></label><label className="grid gap-1 text-xs font-bold">Currency<input required name="currency" defaultValue={detail.currency} className="min-h-10 rounded border bg-transparent px-2" /></label><label className="grid gap-1 text-xs font-bold">Cover image URL<input name="coverImageUrl" defaultValue={detail.coverImageUrl ?? ""} className="min-h-10 rounded border bg-transparent px-2" /></label><button className="min-h-10 self-end rounded bg-rose-600 px-4 font-bold text-white">Save changes</button></form></details>}<ul className="mt-3 divide-y">{detail.roster.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><strong>{row.name || "Guest"}</strong><br/><span className="text-xs">{row.email} · Payment {row.status} · Attendance {row.attendance?.status ?? "none"}</span></span>{row.attendance && <span className="space-x-2">{!row.attendance.status.startsWith("checked_in") && row.attendance.status !== "cancelled" && <button onClick={() => void attendanceAction(row.attendance!.id, "check_in")} className="underline">Check in</button>}{row.attendance.status.startsWith("checked_in") && <button onClick={() => void attendanceAction(row.attendance!.id, "undo_check_in")} className="underline">Undo</button>}{row.attendance.status !== "cancelled" && <button onClick={() => void attendanceAction(row.attendance!.id, "cancel")} className="underline text-red-600">Cancel</button>}</span>}</li>)}</ul></section>}
  </section>
}
