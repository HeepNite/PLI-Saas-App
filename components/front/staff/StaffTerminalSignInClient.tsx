"use client"

import React from "react"
import { Loader2, LockKeyhole } from "lucide-react"

type StaffTerminalOption = {
  id: string
  slug: string
  name: string
  location: string | null
  defaultCourseSlug: string | null
}

export default function StaffTerminalSignInClient({
  terminals,
}: {
  terminals: StaffTerminalOption[]
}) {
  const [slug, setSlug] = React.useState(terminals[0]?.slug || "")
  const [pin, setPin] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const selectedTerminal = React.useMemo(
    () => terminals.find((item) => item.slug === slug) || null,
    [slug, terminals]
  )

  const submit = React.useCallback(async () => {
    if (!slug) {
      setError("Select a terminal.")
      return
    }
    if (!/^\d{4}$/.test(pin.trim())) {
      setError("PIN must be 4 digits.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/staff/terminal/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, pin: pin.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to start the terminal.")
        return
      }
      window.location.assign("/staff/terminal")
    } catch {
      setError("Unable to start the terminal.")
    } finally {
      setBusy(false)
      setPin("")
    }
  }, [pin, slug])

  return (
    <section className="rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.22),transparent_55%),linear-gradient(145deg,rgba(15,19,35,0.97),rgba(20,25,45,0.97))] p-5 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur sm:p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Staff terminal</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Tablet access</h1>
      <p className="mt-2 text-sm text-white/70">
        This session stays fixed on the device and keeps the kiosk separate from staff and customer sessions.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
          <label className="text-xs uppercase tracking-[0.18em] text-white/55">Terminal</label>
          <select
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value)
              setError(null)
            }}
            className="mt-2 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none"
          >
            {terminals.map((terminal) => (
              <option key={terminal.id} value={terminal.slug} className="bg-[#11131a] text-white">
                {terminal.name}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-xs uppercase tracking-[0.18em] text-white/55">PIN</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "").slice(0, 4)
              setPin(next)
              setError(null)
            }}
            className="mt-2 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-3 text-lg tracking-[0.35em] text-white outline-none placeholder:text-white/20"
            placeholder="0000"
          />

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !slug || pin.trim().length !== 4}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand,#b61616)] px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            {busy ? "Opening terminal..." : "Enter terminal"}
          </button>

          {error ? (
            <p className="mt-3 rounded-xl border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-white/55">Selected terminal</p>
          {selectedTerminal ? (
            <div className="mt-3 space-y-3 text-sm text-white/75">
              <div>
                <p className="text-lg font-semibold text-white">{selectedTerminal.name}</p>
                <p className="text-white/55">{selectedTerminal.slug}</p>
              </div>
              <div>
                <p className="text-white/55">Location</p>
                <p>{selectedTerminal.location || "No location assigned"}</p>
              </div>
              <div>
                <p className="text-white/55">Default course</p>
                <p>{selectedTerminal.defaultCourseSlug || "Detect next class automatically"}</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/55">No terminal selected.</p>
          )}
        </div>
      </div>
    </section>
  )
}
