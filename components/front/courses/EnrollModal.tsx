"use client"
import React from "react"
import Link from "next/link"
import CalendarPicker from "../ui/CalendarPicker"
import type { CourseData, EnrollmentOption } from "@/constants/courses"
import GlassyCard from "./GlassyCard"
import { Calendar as CalendarIcon, CalendarRange, CalendarDays, CalendarCheck, CreditCard, Building2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"

// EnrollModal: popup demo to select service, package, add-ons, date, time, and basic contact data.
// - This is a client-only component. It does not call a backend; instead, it logs the payload
//   and shows a local success state. Replace the `handleSubmit` implementation with a real API
//   call when you are ready.
// - All inputs are controlled in the local state for simplicity.

export default function EnrollModal({
  course,
  open,
  onCloseAction,
}: {
  course: CourseData
  open: boolean
  onCloseAction: () => void
}) {
  const { t } = useI18n()
  // Paso 0: opciones/servicios
  const [service, setService] = React.useState<string>(course.enrollment.services[0]?.id ?? "")
  const [pkg, setPkg] = React.useState<string>("")
  const [addons, setAddons] = React.useState<string[]>([])
  const [participants, setParticipants] = React.useState<number>(1)
  // Paso 1: fecha/hora
  const [date, setDate] = React.useState<string>("") // YYYY-MM-DD
  const [time, setTime] = React.useState<string>("") // HH:MM
  // Paso 3: pagos
  type Coupon = { code: string; type: "percent" | "amount"; value: number } | null
  const [couponInput, setCouponInput] = React.useState<string>("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<Coupon>(null)
  const [paymentMethod, setPaymentMethod] = React.useState<"onsite" | "stripe" | "">("")
  // Paso 2: datos de contacto (modular, sin teléfono)
  const [contact, setContact] = React.useState<{ firstName: string; lastName: string; email: string; note: string }>(
    {
      firstName: "",
      lastName: "",
      email: "",
      note: "",
    }
  )
  // Flujo multi‑paso + éxito
  const [step, setStep] = React.useState<number>(0)
  const [success, setSuccess] = React.useState<boolean>(false)

  React.useEffect(() => {
    if (!open) {
      // Reset when closing
      setSuccess(false)
      setAddons([])
      setParticipants(1)
      setDate("")
      setTime("")
      setContact({ firstName: "", lastName: "", email: "", note: "" })
      setStep(0)
    }
  }, [open])

  // No early returns before hooks complete. We will conditionally render at the final return

  const findOpt = (arr: EnrollmentOption[], id: string) => arr.find((o) => o.id === id)
  const serviceOpt = findOpt(course.enrollment.services, service)
  const pkgOpt = findOpt(course.enrollment.packages, pkg)
  const addonsOpts = (course.enrollment.addons || []).filter((a) => addons.includes(a.id))
  const perPerson = (serviceOpt?.price || 0) + (pkgOpt?.price || 0) + addonsOpts.reduce((s, a) => s + (a.price || 0), 0)
  const subtotal = perPerson * Math.max(1, participants)
  const discount = appliedCoupon
    ? appliedCoupon.type === "percent"
      ? (subtotal * appliedCoupon.value) / 100
      : appliedCoupon.value
    : 0
  const total = Math.max(0, subtotal - discount)

  // Helpers
  const to12h = (t: string) => {
    if (!t) return ""
    const [hStr, m] = t.split(":")
    let h = parseInt(hStr, 10)
    const ampm = h >= 12 ? "PM" : "AM"
    h = h % 12
    if (h === 0) h = 12
    return `${h}:${m} ${ampm}`
  }
  const TIME_SLOTS_24 = ["10:00", "11:00", "18:00", "19:00", "20:00"] as const

  // Calendar helpers (Google URL + ICS data URI)
  const eventDates = React.useMemo(() => {
    if (!date || !time) return null as null | { start: Date; end: Date }
    const start = new Date(`${date}T${time}:00`)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // 60 min default
    return { start, end }
  }, [date, time])

  const toUTCStamp = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}T${String(
      d.getUTCHours()
    ).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`

  const googleCalHref = React.useMemo(() => {
    if (!eventDates) return "#"
    const { start, end } = eventDates
    const text = `${course.title} — ${course.enrollment.services.find((s) => s.id === service)?.label || t("classWord")}`
    const details = t("googleCal_details", { participants, total: total.toFixed(2) })
    const location = course.location?.address || "Palladium Latin Institute"
    const dates = `${toUTCStamp(start)}/${toUTCStamp(end)}`
    const url = new URL("https://calendar.google.com/calendar/r/eventedit")
    url.searchParams.set("text", text)
    url.searchParams.set("details", details)
    url.searchParams.set("location", location)
    url.searchParams.set("dates", dates)
    return url.toString()
  }, [eventDates, course, service, participants, total])

  const icsDataUri = React.useMemo(() => {
    if (!eventDates) return "#"
    const { start, end } = eventDates
    const summary = `${course.title} — ${course.enrollment.services.find((s) => s.id === service)?.label || t("classWord")}`
    const description = t("ics_description", { participants, total: total.toFixed(2) })
    const location = course.location?.address || "Palladium Latin Institute"
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PLI//Booking Demo//EN",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@pli.local`,
      `DTSTAMP:${toUTCStamp(new Date())}`,
      `DTSTART:${toUTCStamp(start)}`,
      `DTEND:${toUTCStamp(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
    const content = lines.join("\n")
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`
  }, [eventDates, course, service, participants, total])

  const toggleAddon = (id: string) => {
    setAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    // DEMO: log payload; replace with POST /api/enroll when ready
    const payload = {
      course: course.slug,
      service,
      package: pkg,
      addons,
      date,
      time,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      email: contact.email,
      note: contact.note,
      participants,
      coupon: appliedCoupon?.code || null,
      paymentMethod,
      total,
    }
    console.log("[EnrollModal] demo submit", payload)
    setSuccess(true)
  }

  const steps = [
    { key: "party", label: t("step_party") },
    { key: "datetime", label: t("step_datetime") },
    { key: "info", label: t("step_info") },
    { key: "payments", label: t("step_payments") },
    { key: "review", label: t("step_review") },
  ] as const

  const stepValid = (s: number) => {
    switch (s) {
      case 0:
        // Paquete ahora es opcional según pedido; solo servicio y participantes
        return participants >= 1 && Boolean(service)
      case 1:
        return Boolean(date) && Boolean(time)
      case 2:
        return contact.firstName.trim().length > 1 && contact.email.trim().length > 5
      case 3:
        return paymentMethod !== ""
      case 4:
        return true
      default:
        return false
    }
  }

  const canContinue = stepValid(step)

  return open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("aria_dialog_bookingFor", { title: course.title })}
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
    >
      {/* Backdrop. Click closes modal. */}
      <button
        aria-label={t("aria_close")}
        onClick={onCloseAction}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <GlassyCard className="relative mx-4 w-full max-w-4xl bg-white/70 dark:bg-white/10 p-0 overflow-hidden">
        {/* Close button */}
        <button
          type="button"
          onClick={onCloseAction}
          className="absolute right-3 top-3 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          aria-label={t("aria_close")}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z"/></svg>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Sidebar: stepper (form) OR calendar panel (success) */}
          <aside className="md:col-span-4 lg:col-span-3 bg-neutral-900/90 text-white p-4 space-y-4">
            {success ? (
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold">{t("addToCalendar")}</h4>
                {eventDates ? (
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={googleCalHref}
                      target="_blank"
                      className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
                    >
                      <CalendarIcon className="h-4 w-4" aria-hidden />
                      Google
                    </a>
                    <a
                      href={icsDataUri}
                      download={`pli-${course.slug}-${date}-${time}.ics`}
                      className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
                    >
                      <CalendarRange className="h-4 w-4" aria-hidden />
                      Outlook
                    </a>
                    <a
                      href={icsDataUri}
                      download={`pli-${course.slug}-${date}-${time}.ics`}
                      className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
                    >
                      <CalendarDays className="h-4 w-4" aria-hidden />
                      Yahoo
                    </a>
                    <a
                      href={icsDataUri}
                      download={`pli-${course.slug}-${date}-${time}.ics`}
                      className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
                    >
                      <CalendarCheck className="h-4 w-4" aria-hidden />
                      Apple
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-white/70">{t("calendarsHint")}</p>
                )}

                <div className="pt-2 border-t border-white/10">
                  <div className="text-sm font-semibold">{t("getInTouch")}</div>
                  <p className="mt-1 text-xs text-white/80">{t("assistantChatNote")}</p>
                  <div className="mt-2">
                    {React.createElement(require("../ui/ChatLauncher").default, { className: "w-full" })}
                  </div>
                </div>

                {/* Collapse menu eliminado por requerimiento */}
              </div>
            ) : (
              <>
                <h4 className="text-sm font-semibold">{t("booking")}</h4>
                <ol className="space-y-2">
                  {steps.map((st, idx) => {
                    const done = idx < step && stepValid(idx)
                    const active = idx === step
                    return (
                      <li key={st.key} className={`flex items-center justify-between rounded-md px-3 py-2 border ${active ? "border-white/30 bg-white/5" : "border-white/10 bg-white/0"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${done ? "bg-green-500" : active ? "bg-white text-black" : "bg-white/20"}`}>{done ? "✓" : idx + 1}</span>
                          <span className="text-xs">{st.label}</span>
                        </div>
                        {done && <span className="text-green-400 text-[10px]">{t("done")}</span>}
                      </li>
                    )
                  })}
                </ol>

                {/* Summary */}
                <div className="mt-4 rounded-md border border-white/10 p-3 text-xs space-y-1">
                  <div className="font-semibold mb-1">{t("summary")}</div>
                  <div>{t("service")}: {course.enrollment.services.find((s)=>s.id===service)?.label}</div>
                  <div>{t("package")}: {course.enrollment.packages.find((p)=>p.id===pkg)?.label}</div>
                  {!!addons.length && <div>{t("extras")}: {addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")}</div>}
                  <div>{t("people")}: {participants}</div>
                  <div>{t("dateTime")}: {date || "—"} {to12h(time) || ""}</div>
                  <div>{t("email")}: {contact.email || "—"}</div>
                  <div className="pt-1">{t("total")}: <span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
                </div>

                {/* Get in touch - solo chat */}
                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="text-sm font-semibold">{t("getInTouch")}</div>
                  <p className="mt-1 text-xs text-white/80">{t("assistantChatNote")}</p>
                  <div className="mt-2">
                    {/* Lazy import to avoid circular deps */}
                    {React.createElement(require("../ui/ChatLauncher").default, { className: "w-full" })}
                  </div>
                </div>
              </>
            )}
          </aside>

          {/* Main content */}
          <section className="md:col-span-8 lg:col-span-9 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              {step > 0 && (
                <button
                  type="button"
                  aria-label={t("back")}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="h-8 w-8 rounded-md border border-black/10 flex items-center justify-center"
                >
                  ←
                </button>
              )}
              <h3 className="text-xl sm:text-2xl font-semibold">{steps[step]?.label} • {course.title}</h3>
            </div>

            {success ? (
              <div className="mt-2">
                {/* Success header */}
                <div className="flex flex-col items-center py-4">
                  <div className="mb-2" aria-hidden>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">🎉</span>
                  </div>
                  <h3 className="text-xl font-semibold">{t("congratulations")}</h3>
                  <p className="text-xs text-neutral-500">{t("appointmentId")} {Math.abs((date+time).split("").reduce((a,c)=>a+c.charCodeAt(0),0)%1000) || 56}</p>
                </div>

                {/* Details table */}
                <div className="divide-y divide-black/10 dark:divide-white/10">
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("date")}</div>
                    <div className="text-right">{date}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("localTime")}</div>
                    <div className="text-right">{to12h(time)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("classWord")}:</div>
                    <div className="text-right">{course.title} — {course.enrollment.services.find((s)=>s.id===service)?.label}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("teacher")}</div>
                    <div className="text-right">{course.instructors?.[0]?.name || "—"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("location")}</div>
                    <div className="text-right">{course.location?.address}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("payment")}</div>
                    <div className="text-right">${total.toFixed(2)} — {paymentMethod === "stripe" ? t("payments_stripe") : t("payments_onSite")}</div>
                  </div>
                </div>

                <hr className="my-3 border-black/10 dark:border-white/10" />

                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-neutral-500">{t("name")}:</div>
                    <div className="text-right">{`${contact.firstName} ${contact.lastName}`.trim() || "—"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-neutral-500">{t("email")}</div>
                    <div className="text-right">{contact.email}</div>
                  </div>
                </div>

                {/* Bottom bar actions */}
                <div className="mt-6 border-t border-black/10 dark:border-white/10 px-3 py-3 flex items-center justify-between">
                  <Link href="/panel" className="text-sm font-medium">{t("customerPanel")}</Link>
                  <button onClick={onCloseAction} className="px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white">{t("finish")}</button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e)=>{e.preventDefault(); if(step<steps.length-1){ setStep(step+1) } else { handleSubmit() }}} className="space-y-5">
                {/* Step contents */}
                {step === 0 && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <fieldset className="space-y-2">
                        <label className="text-sm font-medium">{t("label_service")}</label>
                        <select value={service} onChange={(e) => setService(e.target.value)} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2">
                          {course.enrollment.services.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}{s.price ? ` — $${s.price}` : ""}</option>
                          ))}
                        </select>
                      </fieldset>
                      <fieldset className="space-y-2">
                        <label className="text-sm font-medium">{t("label_companion")}</label>
                        <select value={participants} onChange={(e)=>setParticipants(parseInt(e.target.value)||1)} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2">
                          {[1,2,3,4].map(n=> <option key={n} value={n}>{n} {n===1?t("onePerson"):t("manyPeople")}</option>)}
                        </select>
                      </fieldset>
                    </div>

                    {/* Ofertas de paquetes (OPCIONAL) */}
                    {!!course.enrollment.packages.length && (
                      <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">{t("optionalPackages")}</h4>
                          {pkg && (
                            <button type="button" onClick={()=>setPkg("")} className="text-xs underline">{t("removeSelection")}</button>
                          )}
                        </div>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{t("packagesHint")}</p>
                        <div className="mt-3 space-y-2">
                          {course.enrollment.packages.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={()=>setPkg(p.id)}
                              className={`w-full text-left rounded-md border px-3 py-2 ${pkg===p.id?"border-[var(--brand,#111)] bg-[var(--brand,#111)]/5":"border-black/10 dark:border-white/10"}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium">{p.label}</div>
                                  {p.description && <div className="text-xs text-neutral-500">{p.description}</div>}
                                </div>
                                {p.price !== undefined && (
                                  <span className="text-xs rounded-full bg-black/5 dark:bg-white/10 px-2 py-1">${p.price.toFixed(2)}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                          <span className="text-xs text-neutral-500">{t("or")}</span>
                          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                        </div>
                        <button
                          type="button"
                          onClick={()=>{ setPkg(""); setStep(1) }}
                          className="mt-3 w-full rounded-md bg-[var(--brand,#111)] text-white px-4 py-2 text-sm"
                        >
                          {t("skipPackages")}
                        </button>
                      </div>
                    )}

                    {!!course.enrollment.addons?.length && (
                      <fieldset className="space-y-2">
                        <label className="text-sm font-medium">{t("label_extras")}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {course.enrollment.addons!.map((a) => (
                            <label key={a.id} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={addons.includes(a.id)} onChange={() => toggleAddon(a.id)} className="h-4 w-4" />
                              <span>{a.label}{a.price ? ` — $${a.price}` : ""}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="grid grid-cols-1 gap-4">
                    <fieldset className="space-y-2">
                      <label className="text-sm font-medium">{t("step_datetime")}</label>
                      <CalendarPicker value={date} onChange={setDate} className="w-full" />
                    </fieldset>
                    <fieldset className="space-y-2">
                      <label className="text-sm font-medium">{t("label_selectTime")}</label>
                      <div className="flex flex-wrap gap-2">
                        {(TIME_SLOTS_24 as readonly string[]).map((tSlot) => (
                          <button
                            type="button"
                            key={tSlot}
                            onClick={()=>setTime(tSlot)}
                            className={`px-3 py-1.5 rounded-md border text-sm ${time===tSlot?"bg-[var(--brand,#111)] text-white border-transparent":"border-black/10 dark:border-white/10"}`}
                          >
                            {to12h(tSlot)}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <fieldset className="space-y-2">
                      <label className="text-sm font-medium">{t("label_firstName")}</label>
                      <input value={contact.firstName} onChange={(e)=>setContact((c)=>({...c, firstName: e.target.value}))} placeholder={t("placeholder_firstName")} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2" />
                    </fieldset>
                    <fieldset className="space-y-2">
                      <label className="text-sm font-medium">{t("label_lastName")}</label>
                      <input value={contact.lastName} onChange={(e)=>setContact((c)=>({...c, lastName: e.target.value}))} placeholder={t("placeholder_lastName")} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2" />
                    </fieldset>
                    <fieldset className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium">{t("label_email")}</label>
                      <input type="email" value={contact.email} onChange={(e)=>setContact((c)=>({...c, email: e.target.value}))} placeholder={t("placeholder_email")} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2" />
                    </fieldset>
                    <fieldset className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium">{t("label_notes")}</label>
                      <textarea value={contact.note} onChange={(e)=>setContact((c)=>({...c, note: e.target.value}))} rows={3} placeholder={t("placeholder_notes")} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2" />
                    </fieldset>
                    <p className="text-xs text-neutral-500 sm:col-span-2">{t("phoneRemovedNote")}</p>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    {/* Payments step */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2">{t("payments_summary")}</h4>
                      <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 space-y-3">
                        <div className="rounded-md border border-black/10 dark:border-white/10 p-3 bg-white/70 dark:bg-white/10">
                          <div className="text-xs text-neutral-500 mb-1">{t("payments_classes")}</div>
                          <div className="flex items-center justify-between text-sm">
                            <span>
                              {course.title} — {course.enrollment.services.find((s)=>s.id===service)?.label}
                              {perPerson ? ` ($${perPerson.toFixed(2)})` : ""} × {participants} {participants===1?t("onePerson"):t("manyPeople")}
                            </span>
                            <span className="font-medium">${subtotal.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium" htmlFor="coupon">{t("payments_coupon")}</label>
                          <input
                            id="coupon"
                            value={couponInput}
                            onChange={(e)=>setCouponInput(e.target.value)}
                            placeholder={t("payments_coupon_placeholder")}
                            className="flex-1 rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm"
                          />
                          {appliedCoupon ? (
                            <button
                              type="button"
                              onClick={()=>{ setAppliedCoupon(null); setCouponInput("") }}
                              className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
                            >
                              {t("payments_remove")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={()=>{
                                const code = couponInput.trim().toUpperCase()
                                if (code === "PLI10") setAppliedCoupon({ code, type: "percent", value: 10 })
                                else if (code === "PLI20") setAppliedCoupon({ code, type: "percent", value: 20 })
                                else if (!code) return
                                else alert(t("payments_invalidCoupon"))
                              }}
                              className="rounded-md bg-[var(--brand,#111)] text-white px-3 py-2 text-sm"
                            >
                              {t("payments_add")}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm pt-1">
                          <span className="font-medium">{t("payments_totalAmount")}</span>
                          <span className="font-semibold">${total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">{t("payments_method")}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={()=>setPaymentMethod("onsite")}
                          className={`rounded-md border px-4 py-4 text-sm text-left ${paymentMethod==="onsite"?"border-[var(--brand,#111)] bg-[var(--brand,#111)]/5":"border-black/10 dark:border-white/10"}`}
                        >
                          <div className="flex items-center gap-2 font-medium">
                            <Building2 className="h-4 w-4" aria-hidden />
                            {t("payments_onSite")}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">{t("payments_onSite_desc")}</div>
                        </button>
                        <button
                          type="button"
                          onClick={()=>setPaymentMethod("stripe")}
                          className={`rounded-md border px-4 py-4 text-sm text-left ${paymentMethod==="stripe"?"border-[var(--brand,#111)] bg-[var(--brand,#111)]/5":"border-black/10 dark:border-white/10"}`}
                        >
                          <div className="flex items-center gap-2 font-medium">
                            <CreditCard className="h-4 w-4" aria-hidden />
                            {t("payments_stripe")}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">{t("payments_stripe_desc")}</div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <GlassyCard className="p-4">
                      <div className="text-sm space-y-1">
                        <div className="font-medium">{t("reviewAndConfirm")}</div>
                        <div>{t("course")}: {course.title}</div>
                        <div>{t("service")}: {course.enrollment.services.find((s)=>s.id===service)?.label}</div>
                        <div>{t("package")}: {course.enrollment.packages.find((p)=>p.id===pkg)?.label || "—"}</div>
                        {!!addons.length && <div>{t("extras")}: {addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")}</div>}
                        <div>{t("people")}: {participants}</div>
                        <div>{t("dateTime")}: {date} {to12h(time)}</div>
                        <div>{t("name")}: {`${contact.firstName} ${contact.lastName}`.trim() || "—"}</div>
                        <div>{t("email")}: {contact.email || "—"}</div>
                        <div>{t("paymentMethod")}: {paymentMethod || "—"}</div>
                        {contact.note && <div>{t("notes")}: {contact.note}</div>}
                        <div className="pt-2">{t("estimatedTotal")}: <span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
                      </div>
                    </GlassyCard>
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={onCloseAction}
                    className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10"
                  >
                    {t("cancel")}
                  </button>
                  <div className="flex gap-2">
                    <Link href="/panel" className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10 hidden sm:inline">{t("myPanel")}</Link>
                    <button
                      type="button"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      disabled={step === 0}
                      className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10 disabled:opacity-50"
                    >
                      {t("back")}
                    </button>
                    {step < steps.length - 1 ? (
                      <button
                        type="submit"
                        disabled={!canContinue}
                        className="px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50"
                      >
                        {t("continue")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSubmit()}
                        className="px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white"
                      >
                        {t("confirm")}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </section>
        </div>
      </GlassyCard>
    </div>
  ) : null
}
