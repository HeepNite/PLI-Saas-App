"use client"

import React from "react"

type Props = {
  email: string
}

export default function StaffBootstrapClient({ email }: Props) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  const bootstrap = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/staff/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Bootstrap failed")
        return
      }
      setDone(true)
      setTimeout(() => {
        window.location.replace("/staff/portal")
      }, 700)
    } catch {
      setError("Network error while bootstrapping admin")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/8 p-5 shadow-[0_14px_38px_-14px_rgba(182,22,22,0.6)] backdrop-blur sm:p-6">
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">First admin setup</p>
      <h2 className="mt-2 text-2xl font-semibold text-black dark:text-white">Create initial super admin</h2>
      <p className="mt-2 text-sm text-black/70 dark:text-white/70">
        No admin/owner exists yet. This account (<span className="font-semibold">{email || "current user"}</span>) can become the first super admin.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || done}
          onClick={bootstrap}
          className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Creating..." : done ? "Created" : "Create super admin"}
        </button>
        <span className="text-sm text-black/60 dark:text-white/60">After this step, normal staff CRUD becomes available.</span>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
          {error}
        </p>
      ) : null}
    </section>
  )
}
