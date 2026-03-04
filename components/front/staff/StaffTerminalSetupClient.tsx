"use client"

import React from "react"
import { Loader2, RefreshCcw, TabletSmartphone } from "lucide-react"
import { demoCourses } from "@/constants/courses"

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
  const [items, setItems] = React.useState<TerminalRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
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
        setError(typeof data?.error === "string" ? data.error : "No se pudieron cargar las terminals.")
        setItems([])
        return
      }
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setError("No se pudieron cargar las terminals.")
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
      setError("El nombre es requerido.")
      return
    }
    if (form.pin && !/^\d{4}$/.test(form.pin.trim())) {
      setError("El PIN debe tener 4 dígitos.")
      return
    }
    if (!editingId && !/^\d{4}$/.test(form.pin.trim())) {
      setError("Debes definir un PIN inicial de 4 dígitos.")
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
        setError(typeof data?.error === "string" ? data.error : "No se pudo guardar la terminal.")
        return
      }
      setSuccess(typeof data?.message === "string" ? data.message : "Terminal guardada.")
      setEditingId(null)
      setForm(emptyForm)
      await loadItems()
    } catch {
      setError("No se pudo guardar la terminal.")
    } finally {
      setBusy(false)
    }
  }, [editingId, form, loadItems])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.16),transparent_55%),linear-gradient(145deg,rgba(15,19,35,0.97),rgba(20,25,45,0.97))] p-5 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Staff terminal</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Gestión de tablets</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Cada tablet queda autenticada como terminal. El kiosco no comparte ni reemplaza sesiones de staff o clientes.
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
              <p className="text-sm font-semibold text-white">{editingId ? "Editar terminal" : "Nueva terminal"}</p>
              {editingId ? (
                <button
                  type="button"
                  onClick={startCreate}
                  className="text-xs text-white/65 underline"
                >
                  Crear nueva
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">Nombre</span>
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
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">Ubicación</span>
                <input
                  value={form.location}
                  onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none"
                  placeholder="Recepción"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">Curso por defecto</span>
                <select
                  value={form.defaultCourseSlug}
                  onChange={(event) => setForm((prev) => ({ ...prev, defaultCourseSlug: event.target.value }))}
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none"
                >
                  <option value="" className="bg-[#11131a] text-white">Detectar próxima clase automáticamente</option>
                  {demoCourses.map((course) => (
                    <option key={course.slug} value={course.slug} className="bg-[#11131a] text-white">
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">
                  {editingId ? "Nuevo PIN (opcional)" : "PIN"}
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
                Terminal activa
              </label>
            </div>

            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand,#b61616)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TabletSmartphone className="h-4 w-4" />}
              {editingId ? "Guardar cambios" : "Crear terminal"}
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
            <p className="text-sm font-semibold text-white">Terminals registradas</p>
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-white/65">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando terminals...
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
                          item.active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/8 text-white/55"
                        }`}
                      >
                        {item.active ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm text-white/72">
                      <div>
                        <dt className="text-white/45">Ubicación</dt>
                        <dd>{item.location || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-white/45">Curso por defecto</dt>
                        <dd>{item.defaultCourseSlug || "Automático"}</dd>
                      </div>
                      <div>
                        <dt className="text-white/45">Último seen</dt>
                        <dd>{formatDateTime(item.lastSeenAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-white/45">Último uso</dt>
                        <dd>{formatDateTime(item.lastUsedAt)}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Editar
                      </button>
                      <a
                        href="/staff/terminal"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Abrir terminal
                      </a>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-sm text-white/55">Todavía no hay terminals creadas.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
