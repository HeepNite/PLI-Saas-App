"use client"

import React from "react"
import { Loader2, LogOut, MonitorSmartphone } from "lucide-react"
import { useAuth, useClerk } from "@clerk/nextjs"
import CheckInQrClient from "@/components/front/checkin/CheckInQrClient"

type TerminalSummary = {
  id: string
  slug: string
  name: string
  location: string | null
  defaultCourseSlug: string | null
}

export default function StaffTerminalShell({
  terminal,
}: {
  terminal: TerminalSummary
}) {
  const { isLoaded, userId } = useAuth()
  const clerk = useClerk()
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return
    const cleanupKey = `pli-terminal-clerk-clean:${terminal.id}`
    if (window.sessionStorage.getItem(cleanupKey) === "done") return
    window.sessionStorage.setItem(cleanupKey, "done")
    if (!userId) return
    void clerk.signOut({ redirectUrl: "/staff/terminal" })
  }, [clerk, isLoaded, terminal.id, userId])

  const signOutTerminal = React.useCallback(async () => {
    setBusy(true)
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`pli-terminal-clerk-clean:${terminal.id}`)
      }
      await fetch("/api/staff/terminal/session", {
        method: "DELETE",
      })
    } finally {
      window.location.assign("/staff/terminal")
    }
  }, [terminal.id])

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-4">
        <div className="pointer-events-auto flex w-full max-w-4xl items-center justify-between gap-3 rounded-2xl border border-white/12 bg-[#11131a]/88 px-4 py-3 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.72)] backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--brand,#ff4b4b)]">Active terminal</p>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/78">
              <MonitorSmartphone className="h-4 w-4 text-white/55" />
              <span className="truncate font-medium text-white">{terminal.name}</span>
              {terminal.location ? <span className="truncate text-white/50">· {terminal.location}</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOutTerminal()}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:border-[var(--brand,#b61616)] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Switch terminal
          </button>
        </div>
      </div>

      <CheckInQrClient
        forcedDeviceMode="station"
        forcedCourseSlug={terminal.defaultCourseSlug || ""}
        shellVariant="terminal"
        terminalName={terminal.name}
        qrPathOverride="/checkin"
      />
    </div>
  )
}
