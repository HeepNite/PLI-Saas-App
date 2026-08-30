"use client"

import React from "react"
import { formatNationalDraft, getPhoneCountryCatalog, isNationalPhoneDraft, parseCanonicalPhone, parseNationalPhone } from "@/lib/phone"
import { formatSpecialClassDateTime } from "@/lib/special-salsa-class/config"

type PublicSpecialClassProps = {
  item: {
    slug: string; title: string; description: string; coverImageUrl: string | null; priceCents: number; currency: string
    session: { startsAt: string; durationMinutes: number | null; location: string | null; capacity: number }
    availability: { remaining: number; capacity: number } | null
  }
}

export default function PublicSpecialClass({ item }: PublicSpecialClassProps) {
  const [contact, setContact] = React.useState({ name: "", email: "", phone: "" })
  const [phoneCountry, setPhoneCountry] = React.useState<ReturnType<typeof getPhoneCountryCatalog>[number]["country"]>("US")
  const [phoneDraft, setPhoneDraft] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const phoneCountries = React.useMemo(() => getPhoneCountryCatalog(), [])
  const remaining = item.availability?.remaining ?? 0
  const updatePhone = (value: string, country = phoneCountry) => {
    if (value.startsWith("+")) {
      const parsed = parseCanonicalPhone(value)
      if (parsed.ok) {
        setPhoneCountry(parsed.phone.country)
        setPhoneDraft(parsed.phone.nationalDisplay)
        setContact((current) => ({ ...current, phone: parsed.phone.e164 }))
        return
      }
    }
    if (!isNationalPhoneDraft(value)) {
      setPhoneDraft(value)
      setContact((current) => ({ ...current, phone: "" }))
      return
    }
    const formatted = formatNationalDraft(value, country)
    const parsed = parseNationalPhone(formatted, country)
    setPhoneDraft(formatted)
    setContact((current) => ({ ...current, phone: parsed.ok ? parsed.phone.e164 : "" }))
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/checkout/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutKind: "special-class", specialClassSlug: item.slug, attemptId: crypto.randomUUID(), ...contact }) })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be started")
      window.location.assign(result.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout could not be started")
    } finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-3xl px-4 py-12">
    <article className="rounded-3xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-zinc-950">
      <p className="text-sm font-bold uppercase tracking-widest text-rose-600">Special class</p>
      <h1 className="mt-2 text-4xl font-black">{item.title}</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-300">{item.description}</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div><dt className="text-xs uppercase text-zinc-500">Starts</dt><dd className="font-bold">{formatSpecialClassDateTime(new Date(item.session.startsAt))}</dd></div>
        <div><dt className="text-xs uppercase text-zinc-500">Location</dt><dd className="font-bold">{item.session.location ?? "PLI"}</dd></div>
        <div><dt className="text-xs uppercase text-zinc-500">Online availability</dt><dd className="font-bold">{remaining} of {item.availability?.capacity ?? 0} online spots</dd></div>
      </dl>
      <form onSubmit={submit} className="mt-8 grid gap-4" aria-label="Reserve this special class">
        {(["name", "email", "phone"] as const).map((field) => <label key={field} className="grid gap-1 text-sm font-bold capitalize">{field}{field === "phone" && <select name="phone-country" value={phoneCountry} onChange={(event) => { const country = event.target.value as typeof phoneCountry; setPhoneCountry(country); updatePhone(phoneDraft, country) }} className="min-h-11 rounded-lg border border-black/20 bg-transparent px-3">{phoneCountries.map(({ country, callingCode }) => <option key={country} value={country}>{country} (+{callingCode})</option>)}</select>}<input required name={field} type={field === "email" ? "email" : "text"} inputMode={field === "phone" ? "tel" : undefined} value={field === "phone" ? phoneDraft : contact[field]} onChange={(event) => field === "phone" ? updatePhone(event.target.value) : setContact((value) => ({ ...value, [field]: event.target.value }))} className="min-h-11 rounded-lg border border-black/20 bg-transparent px-3" /></label>)}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy || remaining === 0} className="min-h-12 rounded-lg bg-rose-600 px-4 font-bold text-white disabled:bg-zinc-500">{remaining === 0 ? "Sold out" : busy ? "Opening checkout…" : `Reserve for ${(item.priceCents / 100).toLocaleString(undefined, { style: "currency", currency: item.currency })}`}</button>
        {remaining > 0 && <p className="text-xs text-zinc-500">Your place is held for up to three minutes while you complete checkout.</p>}
      </form>
    </article>
  </main>
}
