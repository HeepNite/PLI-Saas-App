import React from "react"

import { getNewYorkDateKey, type CoursePromotion, type CoursePromotionChannel } from "@/lib/promotions/course-promotions"
import type { CourseFormState } from "./staffAdminTypes"

const FIELD = "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
const CHANNELS: Array<{ value: CoursePromotionChannel; label: string }> = [
  { value: "public_booking", label: "Booking web" },
  { value: "profile", label: "Profile" },
  { value: "trusted_kiosk", label: "Trusted kiosk" },
]

type Props = {
  visible: boolean
  courseForm: CourseFormState
  setCourseForm: React.Dispatch<React.SetStateAction<CourseFormState>>
}

const nextId = (promotions: CoursePromotion[]) => {
  let index = promotions.length + 1
  while (promotions.some(({ id }) => id === `promotion-${index}`)) index += 1
  return `promotion-${index}`
}

export default function StaffCoursePromotionsStep({ visible, courseForm, setCourseForm }: Props) {
  if (!visible) return null
  const promotions = courseForm.promotions ?? []
  const update = (index: number, updater: (promotion: CoursePromotion) => CoursePromotion) => {
    setCourseForm((previous) => ({
      ...previous,
      promotions: (previous.promotions ?? []).map((promotion, itemIndex) => itemIndex === index ? updater(promotion) : promotion),
    }))
  }
  const add = () => {
    const date = getNewYorkDateKey()
    setCourseForm((previous) => {
      const current = previous.promotions ?? []
      return { ...previous, promotions: [...current, {
        id: nextId(current), label: "New promotion", active: false,
        pricing: { kind: "fixed", amountCents: 1500 },
        window: { basis: "class_date", startDate: date, endDate: date },
        audience: "everyone", channels: ["public_booking", "profile"],
      }] }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-semibold text-black dark:text-white">Course promotions</p><p className="text-xs text-black/55 dark:text-white/55">Final eligibility and price are always recalculated by the server.</p></div>
        <button type="button" onClick={add} disabled={promotions.length >= 12} className="rounded-md bg-[var(--brand,#b61616)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Add promotion</button>
      </div>
      {promotions.length === 0 ? <p className="rounded-lg border border-dashed border-black/15 p-4 text-sm text-black/55 dark:border-white/15 dark:text-white/55">No promotions configured.</p> : null}
      {promotions.map((promotion, index) => (
        <fieldset key={promotion.id} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.16em]">Promotion {index + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <input aria-label={`Promotion ${index + 1} label`} className={FIELD} value={promotion.label} onChange={(event) => update(index, (item) => ({ ...item, label: event.target.value }))} />
            <input aria-label={`Promotion ${index + 1} id`} className={FIELD} value={promotion.id} onChange={(event) => update(index, (item) => ({ ...item, id: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") }))} />
            <select aria-label={`Promotion ${index + 1} pricing`} className={FIELD} value={promotion.pricing.kind} onChange={(event) => update(index, (item) => ({ ...item, pricing: event.target.value === "percentage" ? { kind: "percentage", percentOff: 10 } : { kind: "fixed", amountCents: 1500 } }))}>
              <option value="fixed">Fixed final price</option><option value="percentage">Percentage off</option>
            </select>
            <input aria-label={`Promotion ${index + 1} value`} className={FIELD} type="number" min={promotion.pricing.kind === "fixed" ? 0.5 : 1} max={promotion.pricing.kind === "percentage" ? 99 : undefined} step={promotion.pricing.kind === "fixed" ? 0.01 : 1} value={promotion.pricing.kind === "fixed" ? promotion.pricing.amountCents / 100 : promotion.pricing.percentOff} onChange={(event) => update(index, (item) => ({ ...item, pricing: item.pricing.kind === "fixed" ? { kind: "fixed", amountCents: Math.round(Number(event.target.value) * 100) } : { kind: "percentage", percentOff: Math.round(Number(event.target.value)) } }))} />
            <select aria-label={`Promotion ${index + 1} date basis`} className={FIELD} value={promotion.window.basis} onChange={(event) => update(index, (item) => ({ ...item, window: { ...item.window, basis: event.target.value === "purchase_date" ? "purchase_date" : "class_date" } }))}>
              <option value="class_date">Class date</option><option value="purchase_date">Purchase date</option>
            </select>
            <select aria-label={`Promotion ${index + 1} audience`} className={FIELD} value={promotion.audience} onChange={(event) => update(index, (item) => ({ ...item, audience: event.target.value === "heritage_pin_delivered" ? "heritage_pin_delivered" : "everyone" }))}>
              <option value="everyone">Everyone</option><option value="heritage_pin_delivered">Delivered Heritage pin</option>
            </select>
            <input aria-label={`Promotion ${index + 1} start date`} className={FIELD} type="date" value={promotion.window.startDate} onChange={(event) => update(index, (item) => ({ ...item, window: { ...item.window, startDate: event.target.value } }))} />
            <input aria-label={`Promotion ${index + 1} end date`} className={FIELD} type="date" value={promotion.window.endDate} onChange={(event) => update(index, (item) => ({ ...item, window: { ...item.window, endDate: event.target.value } }))} />
          </div>
          <div className="flex flex-wrap gap-4">{CHANNELS.map(({ value, label }) => <label key={value} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={promotion.channels.includes(value)} onChange={() => update(index, (item) => ({ ...item, channels: item.channels.includes(value) ? item.channels.filter((channel) => channel !== value) : [...item.channels, value] }))} />{label}</label>)}</div>
          <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={promotion.active} onChange={(event) => update(index, (item) => ({ ...item, active: event.target.checked }))} />Active</label><button type="button" onClick={() => setCourseForm((previous) => ({ ...previous, promotions: (previous.promotions ?? []).filter((_, itemIndex) => itemIndex !== index) }))} className="text-xs font-semibold text-red-600">Remove</button></div>
        </fieldset>
      ))}
    </div>
  )
}
