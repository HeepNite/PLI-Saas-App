"use client"

import React from "react"
import { Loader2, RefreshCcw, TabletSmartphone } from "lucide-react"
import { demoCourses } from "@/constants/courses"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"

type TerminalRow = {
  id: string
  slug: string
  name: string
  location: string | null
  defaultCourseSlug: string | null
  active: boolean
  lastSeenAt: string | null
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
  pinAlert?: {
    severity: "warning" | "cooldown" | "emergency"
    label: string
    message: string
    blockedUntil: string | null
    missCount: number
  } | null
}

type FormState = {
  name: string
  slug: string
  location: string
  defaultCourseSlug: string
  pin: string
  active: boolean
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  location: "",
  defaultCourseSlug: "",
  pin: "",
  active: true,
}

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

const formatDateTime = (value: string | null) => {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(parsed)
}

export default function StaffTerminalSetupClient() {
  const { courses: catalogCourses } = useCatalogCourses()
  const sourceCourses = catalogCourses.length ? catalogCourses : demoCourses
  const [items, setItems] = React.useState<TerminalRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const loadItems = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/staff/terminals", { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not load terminals.")
        setItems([])
        return
      }
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setError("Could not load terminals.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadItems()
  }, [loadItems])

  const startCreate = React.useCallback(() => {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setSuccess(null)
  }, [])

  const startEdit = React.useCallback((item: TerminalRow) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      slug: item.slug,
      location: item.location || "",
      defaultCourseSlug: item.defaultCourseSlug || "",
      pin: "",
      active: item.active,
    })
    setError(null)
    setSuccess(null)
  }, [])

  const submit = React.useCallback(async () => {
    if (!form.name.trim()) {
      setError("Name is required.")
      return
    }
    if (form.pin && !/^\d{4}$/.test(form.pin.trim())) {
      setError("PIN must be 4 digits.")
      return
    }
    if (!editingId && !/^\d{4}$/.test(form.pin.trim())) {
      setError("You must define an initial 4-digit PIN.")
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const url = editingId ? `/api/staff/terminals/${editingId}` : "/api/staff/terminals"
      const method = editingId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || toSlug(form.name),
          location: form.location,
          defaultCourseSlug: form.defaultCourseSlug,
          pin: form.pin,
          active: form.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to save terminal.")
        return
      }
      setSuccess(typeof data?.message === "string" ? data.message : "Terminal saved.")
      setEditingId(null)
      setForm(emptyForm)
      await loadItems()
    } catch {
      setError("Unable to save terminal.")
    } finally {
      setBusy(false)
    }
  }, [editingId, form, loadItems])

  const removeTerminal = React.useCallback(
    async (item: TerminalRow) => {
      const confirmDelete = window.confirm(`Delete terminal "${item.name}"?`)
      if (!confirmDelete) return
      setDeletingId(item.id)
      setError(null)
      setSuccess(null)
      try {
        const res = await fetch(`/api/staff/terminals/${item.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : "Unable to delete terminal.")
          return
        }
        if (editingId === item.id) {
          setEditingId(null)
          setForm(emptyForm)
        }
        setSuccess(typeof data?.message === "string" ? data.message : "Terminal deleted.")
        await loadItems()
      } catch {
        setError("Unable to delete terminal.")
      } finally {
        setDeletingId(null)
      }
    },
    [editingId, loadItems]
  )

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.16),transparent_55%),linear-gradient(145deg,rgba(15,19,35,0.97),rgba(20,25,45,0.97))] p-5 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Staff terminal</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Tablet management</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Each tablet is authenticated as a terminal. The kiosk does not share or replace staff or customer sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white transition hover:border-[var(--brand,#b61616)] disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{editingId ? "Edit terminal" : "New terminal"}</p>
              {editingId ? (
                <button
                  type="button"
                  onClick={startCreate}
                  className="text-xs text-white/65 underline"
                >
                  Create new
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none"
                  placeholder="Front desk 1"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: toSlug(event.target.value) }))}
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none"
                  placeholder="front-desk-1"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">Location</span>
                <input
                  value={form.location}
                  onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none"
                  placeholder="Front desk"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">Default course</span>
                <select
                  value={form.defaultCourseSlug}
                  onChange={(event) => setForm((prev) => ({ ...prev, defaultCourseSlug: event.target.value }))}
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none"
                >
                  <option value="" className="bg-[#11131a] text-white">Detect next class automatically</option>
                  {sourceCourses.map((course) => (
                    <option key={course.slug} value={course.slug} className="bg-[#11131a] text-white">
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">
                  {editingId ? "New PIN (optional)" : "PIN"}
                </span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.pin}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, pin: event.target.value.replace(/\D/g, "").slice(0, 4) }))
                  }
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-lg tracking-[0.35em] text-white outline-none"
                  placeholder="0000"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-white/75">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                />
                Active terminal
              </label>
            </div>

            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand,#b61616)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TabletSmartphone className="h-4 w-4" />}
              {editingId ? "Save changes" : "Create terminal"}
            </button>

            {error ? (
              <p className="mt-3 rounded-xl border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {success}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">Registered terminals</p>
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-white/65">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading terminals...
                </div>
              ) : items.length ? (
                items.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="text-xs text-white/55">{item.slug}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          item.pinAlert?.severity === "emergency"
                            ? "bg-[var(--brand,#b61616)]/15 text-red-200"
                            : item.pinAlert?.severity === "cooldown"
                              ? "bg-amber-500/15 text-amber-200"
                              : item.pinAlert?.severity === "warning"
                                ? "bg-yellow-500/15 text-yellow-200"
                                : item.active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/8 text-white/55"
                        }`}
                      >
                        {item.pinAlert?.label || (item.active ? "Active" : "Inactive")}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm text-white/72">
                      <div>
                        <dt className="text-white/45">Location</dt>
                        <dd>{item.location || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-white/45">Default course</dt>
                        <dd>{item.defaultCourseSlug || "Automatic"}</dd>
                      </div>
                      <div>
                        <dt className="text-white/45">Last seen</dt>
                        <dd>{formatDateTime(item.lastSeenAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-white/45">Last used</dt>
                        <dd>{formatDateTime(item.lastUsedAt)}</dd>
                      </div>
                      {item.pinAlert ? (
                        <div>
                          <dt className="text-white/45">PIN activity</dt>
                          <dd>
                            {item.pinAlert.message}
                            {item.pinAlert.blockedUntil ? ` Until ${formatDateTime(item.pinAlert.blockedUntil)}.` : ""}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => void removeTerminal(item)}
                        className="rounded-xl border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-xs font-semibold text-[var(--brand,#ff4b4b)] disabled:opacity-50"
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                      <a
                        href="/staff/terminal"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Open terminal
                      </a>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-sm text-white/55">No terminals created yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
