"use client"

import { useState, type FormEvent } from "react"
import { RAFFLE_PRIMARY_BUTTON_CLASS } from "./raffleButtonStyles"

export default function RaffleAccessForm({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function authorize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const key = String(new FormData(form).get("key") ?? "").trim()
    form.reset()
    if (!key) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/raffle/${encodeURIComponent(slug)}/screen-session?key=${encodeURIComponent(key)}`, {
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      })
      if (!response.ok) {
        setError(response.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Access could not be authorized. Check your private key or open the original private link.")
        return
      }
      window.location.replace(`/staff/raffle/${encodeURIComponent(slug)}/screen`)
    } catch {
      setError("Unable to connect. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={authorize} method="post" action={`/api/raffle/${encodeURIComponent(slug)}/screen-session`} className="space-y-4" autoComplete="off">
      <noscript>JavaScript is required to enter a key here. You can still open the original private link.</noscript>
      <label htmlFor="raffle-access-key" className="block text-sm font-medium">Private access key</label>
      <input id="raffle-access-key" name="key" type="password" required autoComplete="off" autoCapitalize="none" spellCheck={false}
        disabled={busy} className="min-h-12 w-full rounded-lg border border-white/30 bg-black/60 px-3 text-white focus-visible:outline-2 focus-visible:outline-white" />
      {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
      <button type="submit" disabled={busy} className={`${RAFFLE_PRIMARY_BUTTON_CLASS} min-h-12 w-full rounded-lg px-4 py-3`}>
        {busy ? "Authorizing…" : "Open raffle screen"}
      </button>
    </form>
  )
}
