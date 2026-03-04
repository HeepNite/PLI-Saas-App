"use client"

import React from "react"
import { ArrowLeft, CheckCircle2, Clock3, Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useAuth, useClerk, useSignIn } from "@clerk/nextjs"

type PinCheckInResponse = {
  ok: boolean
  signInUrl: string
  ticket?: string
  checkedInAt: string
  staff: {
    id: string
    name: string
    role: string
    category: string | null
  }
}

const PIN_LENGTH = 4
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]

export default function StaffCheckInClient() {
  const searchParams = useSearchParams()
  const { userId: activeUserId, sessionId: activeSessionId } = useAuth()
  const { signOut } = useClerk()
  const { isLoaded, signIn, setActive } = useSignIn()
  const [pin, setPin] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [now, setNow] = React.useState<Date | null>(null)
  const terminalMode =
    (searchParams.get("mode") || "").trim().toLowerCase() === "terminal" ||
    (searchParams.get("terminal") || "").trim() === "1"

  React.useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const nowLabel = React.useMemo(
    () => {
      if (!now) return "—:—:—"
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(now)
    },
    [now]
  )

  const appendDigit = React.useCallback((digit: string) => {
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev
      return `${prev}${digit}`
    })
    setError(null)
    setSuccess(null)
  }, [])

  const clearPin = React.useCallback(() => {
    setPin("")
    setError(null)
    setSuccess(null)
  }, [])

  const removeDigit = React.useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
    setError(null)
    setSuccess(null)
  }, [])

  const submitPin = React.useCallback(async () => {
    if (pin.length !== PIN_LENGTH) {
      setError("Ingresá un PIN válido de 4 dígitos.")
      setPin("")
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          preferUserId: terminalMode ? "" : activeUserId || "",
        }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<PinCheckInResponse> & { error?: string }
      if (!res.ok || (!terminalMode && !data?.signInUrl)) {
        setError(typeof data?.error === "string" ? data.error : "PIN inválido.")
        setPin("")
        return
      }

      const name = data?.staff?.name || "staff"
      setSuccess(terminalMode ? `Check-in registrado para ${name}.` : `Check-in registrado para ${name}. Redirigiendo...`)
      setPin("")
      if (terminalMode) return

      if (activeUserId && data?.staff?.id === activeUserId) {
        window.location.assign("/staff/resolve")
        return
      }

      if (activeSessionId && activeUserId && data?.staff?.id && data.staff.id !== activeUserId) {
        try {
          await signOut({ sessionId: activeSessionId })
        } catch {
          // continue with the new sign-in attempt even if the previous session could not be cleared.
        }
      }

      const ticket = typeof data.ticket === "string" ? data.ticket.trim() : ""
      if (isLoaded && signIn && setActive && ticket) {
        try {
          const attempt = (await signIn.create({
            strategy: "ticket",
            ticket,
          })) as { status?: string; createdSessionId?: string | null }
          if (attempt.status === "complete" && attempt.createdSessionId) {
            await setActive({ session: attempt.createdSessionId })
            window.location.assign("/staff/resolve")
            return
          }
        } catch {
          // fallback below
        }
      }

      window.location.assign(data.signInUrl!)
    } catch {
      setError("No se pudo validar el PIN. Intentá nuevamente.")
      setPin("")
      setSuccess(null)
    } finally {
      setBusy(false)
    }
  }, [activeSessionId, activeUserId, isLoaded, pin, setActive, signIn, signOut, terminalMode])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (busy) return
      if (event.key >= "0" && event.key <= "9") {
        event.preventDefault()
        appendDigit(event.key)
        return
      }
      if (event.key === "Backspace") {
        event.preventDefault()
        removeDigit()
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        clearPin()
        return
      }
      if (event.key === "Enter") {
        event.preventDefault()
        void submitPin()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [appendDigit, busy, clearPin, removeDigit, submitPin])

  return (
    <section className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-[0_14px_38px_-14px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-6">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Check-in</p>
        <h2 className="mt-2 text-2xl font-semibold text-black dark:text-white">Ingreso por PIN</h2>
        <p className="mt-2 text-sm text-black/65 dark:text-white/65">
          {terminalMode
            ? "Ingresá tu PIN para marcar entrada. Al validar, el terminal registra tu ingreso sin cambiar la sesión activa."
            : "Ingresá tu PIN para marcar entrada y entrar directo a tu panel según tu rol."}
        </p>
      </header>

      <div className="mt-5 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-center gap-2">
          {Array.from({ length: PIN_LENGTH }).map((_, index) => {
            const filled = index < pin.length
            return (
              <span
                key={`pin-dot-${index}`}
                className={`h-3 w-3 rounded-full border ${
                  filled
                    ? "border-[var(--brand,#b61616)] bg-[var(--brand,#b61616)]"
                    : "border-black/25 bg-transparent dark:border-white/25"
                }`}
              />
            )
          })}
        </div>
        <div className="mb-4 flex items-center justify-center gap-2 text-sm text-black/70 dark:text-white/70">
          <Clock3 className="h-4 w-4 text-[var(--brand,#b61616)]" />
          <span>Hora actual: {nowLabel}</span>
        </div>

        <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2">
          {DIGITS.slice(0, 9).map((digit) => (
            <button
              key={`digit-${digit}`}
              type="button"
              onClick={() => appendDigit(digit)}
              disabled={busy}
              className="rounded-md border border-black/15 bg-white px-3 py-3 text-lg font-semibold text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.02] dark:text-white"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={clearPin}
            disabled={busy}
            className="rounded-md border border-black/15 bg-white px-3 py-3 text-sm font-semibold text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.02] dark:text-white"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => appendDigit("0")}
            disabled={busy}
            className="rounded-md border border-black/15 bg-white px-3 py-3 text-lg font-semibold text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.02] dark:text-white"
          >
            0
          </button>
          <button
            type="button"
            onClick={removeDigit}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-md border border-black/15 bg-white px-3 py-3 text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.02] dark:text-white"
            aria-label="Borrar último número"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-auto mt-4 w-full max-w-sm">
          <button
            type="button"
            onClick={() => void submitPin()}
            disabled={busy || pin.length !== PIN_LENGTH}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand,#b61616)] px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? "Validando..." : "Marcar entrada"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      ) : null}
    </section>
  )
}
