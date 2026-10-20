"use client"

import { useEffect, useRef, useState } from "react"
import RaffleBackdrop from "./RaffleBackdrop"
import { RAFFLE_PRIMARY_BUTTON_CLASS } from "./raffleButtonStyles"
import { RaffleQrPanel } from "./RaffleScreenSeams"

type RafflePrizeSetupProps = {
  slug: string
  revision: string
  prizes: string[]
  entryCount: number
  entryUrl?: string | null
  onRefresh: () => void
  onStarted: () => void
}

type PrizeResponse = {
  status?: string
  revision?: string
  prizes?: string[]
} | null

const SHELL_CLASS =
  "flex min-h-dvh w-full flex-col items-center justify-center gap-5 px-4 py-6 text-white sm:px-6"

export default function RafflePrizeSetup({
  slug,
  revision,
  prizes,
  entryCount,
  entryUrl = null,
  onRefresh,
  onStarted,
}: RafflePrizeSetupProps) {
  const [labels, setLabels] = useState(prizes)
  const [currentRevision, setCurrentRevision] = useState(revision)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const lastServerRevision = useRef(revision)

  useEffect(() => {
    if (lastServerRevision.current === revision) return
    lastServerRevision.current = revision
    setLabels(prizes)
    setCurrentRevision(revision)
  }, [prizes, revision])

  const updateLabel = (index: number, value: string) =>
    setLabels((current) => current.map((label, labelIndex) => (labelIndex === index ? value : label)))

  const move = (index: number, offset: -1 | 1) => {
    setLabels((current) => {
      const target = index + offset
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const remove = (index: number) => {
    if (labels.length === 1) return
    setLabels((current) => current.filter((_, labelIndex) => labelIndex !== index))
  }

  const submit = async (action: "save" | "start") => {
    if (busy) return
    const normalized = labels.map((label) => label.trim())
    if (normalized.some((label) => !label || label.length > 120)) {
      setError("Every prize needs a name of 120 characters or fewer.")
      return
    }
    if (action === "start" && !window.confirm("Start raffle? The prize list cannot be edited after this.")) return

    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`/api/raffle/${encodeURIComponent(slug)}/prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, revision: currentRevision, prizes: normalized }),
      })
      const body = (await response.json().catch(() => null)) as PrizeResponse
      if (response.ok && body?.status === "saved" && body.revision && body.prizes) {
        setCurrentRevision(body.revision)
        setLabels(body.prizes)
        setMessage("Prize list saved")
        onRefresh()
        return
      }
      if (response.ok && body?.status === "started") {
        onStarted()
        return
      }
      if (response.status === 409) {
        setError(body?.status === "prize_setup_locked" ? "This raffle has already started." : "The prize list changed. Review the refreshed list and try again.")
        onRefresh()
        return
      }
      setError(response.status === 429 ? "Too many attempts. Wait a minute and try again." : "Could not save the prize list. Try again.")
    } catch {
      setError("Could not reach the server. Check the connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <RaffleBackdrop className={SHELL_CLASS}>
      <div className="w-full max-w-2xl space-y-5 rounded-2xl border border-white/20 bg-black/70 p-5 sm:p-7">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Prize setup</h1>
          <p className="text-white/70">Add prizes in draw order. Starting the raffle permanently locks this list.</p>
          <p className="text-white/60">{entryCount} entered</p>
        </div>

        <div className="space-y-3">
          {labels.map((label, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/20 p-3">
              <span className="w-7 text-sm text-white/60">{index + 1}.</span>
              <input
                aria-label={`Prize ${index + 1}`}
                value={label}
                maxLength={120}
                disabled={busy}
                onChange={(event) => updateLabel(index, event.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-white/30 bg-black/60 px-3 text-white"
              />
              <button type="button" aria-label={`Move prize ${index + 1} up`} disabled={busy || index === 0} onClick={() => move(index, -1)} className="min-h-11 rounded-md border border-white/30 px-3 disabled:opacity-30">↑</button>
              <button type="button" aria-label={`Move prize ${index + 1} down`} disabled={busy || index === labels.length - 1} onClick={() => move(index, 1)} className="min-h-11 rounded-md border border-white/30 px-3 disabled:opacity-30">↓</button>
              <button type="button" aria-label={`Remove prize ${index + 1}`} disabled={busy || labels.length === 1} onClick={() => remove(index)} className="min-h-11 rounded-md border border-red-300/50 px-3 text-red-100 disabled:opacity-30">Remove</button>
            </div>
          ))}
        </div>

        <button type="button" disabled={busy || labels.length >= 50} onClick={() => setLabels((current) => [...current, "New prize"])} className="min-h-11 rounded-md border border-white/40 px-4 py-2 font-semibold disabled:opacity-40">
          Add prize
        </button>

        {entryUrl ? <RaffleQrPanel entryUrl={entryUrl} /> : null}
        {message ? <p role="status" className="text-center text-sm text-green-200">{message}</p> : null}
        {error ? <p role="alert" className="text-center text-sm text-red-200">{error}</p> : null}

        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" disabled={busy} onClick={() => submit("save")} className="min-h-12 rounded-md border border-white/40 px-6 py-3 font-semibold disabled:opacity-40">
            Save prizes
          </button>
          <button type="button" disabled={busy} onClick={() => submit("start")} className={`${RAFFLE_PRIMARY_BUTTON_CLASS} px-6 py-3 text-lg`}>
            Start raffle
          </button>
        </div>
      </div>
    </RaffleBackdrop>
  )
}
