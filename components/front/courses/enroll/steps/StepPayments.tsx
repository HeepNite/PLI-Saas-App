"use client"
import React from "react"
import { Building2, CreditCard } from "lucide-react"
import type { Coupon, EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import type { CourseEnrollmentData } from "@/components/front/courses/types"
import type { EnrollmentOption } from "@/constants/courses"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"
import type { I18nKey } from "@/lib/i18n-dict"
import { formatFriendlyDateTime } from "@/components/front/courses/utils/datetime"

type StepPaymentsProps = {
  isCheckInFlow: boolean
  isKioskTerminalFlow: boolean
  course: CourseEnrollmentData
  pkg: string
  service: string
  date: string
  time: string
  participants: number
  contact: EnrollmentContact
  addons: string[]
  to12h: (value: string) => string
  consecutiveAccepted: boolean
  consecutiveAddedCents: number
  effectiveConsecutiveOffer: ConsecutiveOfferData | null | undefined
  kioskQrCheckoutLocked: boolean
  couponInput: string
  setCouponInput: React.Dispatch<React.SetStateAction<string>>
  appliedCoupon: Coupon
  setAppliedCoupon: React.Dispatch<React.SetStateAction<Coupon>>
  subtotal: number
  total: number
  serviceOpt: EnrollmentOption | undefined | null
  pkgOpt: EnrollmentOption | undefined | null
  addonsOpts: EnrollmentOption[]
  paymentMethod: PaymentMethod
  setPaymentMethod: (value: React.SetStateAction<PaymentMethod>) => void
  t: (key: I18nKey) => string
}

export default function StepPayments({
  isCheckInFlow,
  isKioskTerminalFlow,
  course,
  pkg,
  service,
  date,
  time,
  participants,
  contact,
  addons,
  to12h,
  consecutiveAccepted,
  consecutiveAddedCents,
  effectiveConsecutiveOffer,
  kioskQrCheckoutLocked,
  couponInput,
  setCouponInput,
  appliedCoupon,
  setAppliedCoupon,
  subtotal,
  total,
  serviceOpt,
  pkgOpt,
  addonsOpts,
  paymentMethod,
  setPaymentMethod,
  t,
}: StepPaymentsProps) {
  const mobileQrCheckin = isCheckInFlow && !isKioskTerminalFlow

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[1.15rem] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(182,22,22,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%),linear-gradient(145deg,rgba(44,45,55,0.96),rgba(19,20,27,0.99))] p-4 text-white shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)]">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
        <div className="relative space-y-4">
          {isCheckInFlow && (
            <>
              <div>
                <div className="text-sm font-semibold text-white">{t("reviewAndConfirm")}</div>
                <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-white/68 sm:grid-cols-2">
                  {!mobileQrCheckin && (
                    <div>{t("course")}: <span className="text-white">{course.title}</span></div>
                  )}
                  <div>{t("service")}: <span className="text-white">{course.enrollment.services.find((s) => s.id === service)?.label}{pkgOpt ? " (included in package)" : ""}</span></div>
                  <div>{t("dateTime")}: <span className="text-white">{mobileQrCheckin ? formatFriendlyDateTime(date, time, to12h) : `${date} ${to12h(time)}`}</span></div>
                  <div>{t("people")}: <span className="text-white">{participants}</span></div>
                  <div>{t("name")}: <span className="text-white">{`${contact.firstName} ${contact.lastName}`.trim() || "—"}</span></div>
                  <div>{t("email")}: <span className="text-white">{contact.email || "—"}</span></div>
                  <div>Phone: <span className="text-white">{contact.phone || "—"}</span></div>
                  {!!addons.length && (
                    <div>{t("extras")}: <span className="text-white">{addons.map((a) => course.enrollment.addons?.find((x) => x.id === a)?.label).filter(Boolean).join(", ")}</span></div>
                  )}
                  {pkg && (
                    <div>{t("package")}: <span className="text-white">{course.enrollment.packages.find((p) => p.id === pkg)?.label || "—"}</span></div>
                  )}
                  {contact.note && <div className="sm:col-span-2">{t("notes")}: <span className="text-white">{contact.note}</span></div>}
                </div>
              </div>
              <div className="h-px bg-white/12" aria-hidden />
            </>
          )}

          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/48">{t("payments_classes")}</div>
            <div className="mt-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-snug text-white">
                  {course.title}{time ? ` · ${to12h(time)}` : ""} — {mobileQrCheckin && pkgOpt ? pkgOpt.label : course.enrollment.services.find((s) => s.id === service)?.label}
                </div>
                {!mobileQrCheckin && (
                  <>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/58">
                      {date && <span>Date: {date}{time ? ` · ${to12h(time)}` : ""}</span>}
                      {course.location?.address && <span>Address: {course.location.address}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/58">
                      <span>{participants} {participants === 1 ? t("onePerson") : t("manyPeople")}</span>
                      <span>Service: {serviceOpt?.label || "—"}{pkgOpt ? " (included)" : ""}</span>
                      {pkgOpt && <span>Package: {pkgOpt.label}</span>}
                      {!!addonsOpts.length && <span>Extras: {addonsOpts.map((a) => a.label).join(", ")}</span>}
                    </div>
                  </>
                )}
              </div>
              <span className="shrink-0 text-sm font-semibold text-white">${subtotal.toFixed(2)}</span>
            </div>
            {consecutiveAccepted && effectiveConsecutiveOffer && (
              <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-snug text-white">
                    + {effectiveConsecutiveOffer.linkedCourseTitle}{effectiveConsecutiveOffer.linkedCourseTime ? ` · ${to12h(effectiveConsecutiveOffer.linkedCourseTime)}` : ""}
                  </div>
                  <div className="mt-0.5 text-[11px] text-emerald-300/70">
                    Second class promotion
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-emerald-300">${(consecutiveAddedCents / 100).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="text-sm font-medium shrink-0" htmlFor="coupon">{t("payments_coupon")}</label>
            <input
              id="coupon"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder={t("payments_coupon_placeholder")}
              disabled={kioskQrCheckoutLocked}
              className="min-w-0 flex-1 rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm"
            />
            {appliedCoupon ? (
              <button
                type="button"
                disabled={kioskQrCheckoutLocked}
                onClick={() => { setAppliedCoupon(null); setCouponInput("") }}
                className="shrink-0 rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
              >
                {t("payments_remove")}
              </button>
            ) : (
              <button
                type="button"
                disabled={kioskQrCheckoutLocked}
                onClick={() => {
                  const code = couponInput.trim().toUpperCase()
                  if (code === "PLI10") setAppliedCoupon({ code, type: "percent", value: 10 })
                  else if (code === "PLI20") setAppliedCoupon({ code, type: "percent", value: 20 })
                  else if (!code) return
                  else alert(t("payments_invalidCoupon"))
                }}
                className="shrink-0 rounded-md bg-[var(--brand,#111)] text-white px-3 py-2 text-sm"
              >
                {t("payments_add")}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
            <span className="font-medium">{t("payments_totalAmount")}</span>
            <span className="font-semibold">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">{t("payments_method")}</h4>
        <div className={`grid gap-3 ${mobileQrCheckin ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
          <button
            type="button"
            disabled={kioskQrCheckoutLocked}
            onClick={() => setPaymentMethod("onsite")}
            className={`rounded-md border px-4 py-4 text-sm text-left ${paymentMethod === "onsite" ? "border-[var(--brand,#111)] bg-[var(--brand,#111)]/5" : "border-black/10 dark:border-white/10"}`}
          >
            <div className="flex items-center gap-2 font-medium">
              <Building2 className="h-4 w-4" aria-hidden />
              {t("payments_onSite")}
            </div>
            <div className="mt-1 text-xs text-neutral-500">{t("payments_onSite_desc")}</div>
          </button>
          <button
            type="button"
            disabled={kioskQrCheckoutLocked}
            onClick={() => setPaymentMethod("stripe")}
            className={`rounded-md border px-4 py-4 text-sm text-left ${paymentMethod === "stripe" ? "border-[var(--brand,#111)] bg-[var(--brand,#111)]/5" : "border-black/10 dark:border-white/10"}`}
          >
            <div className="flex items-center gap-2 font-medium">
              <CreditCard className="h-4 w-4" aria-hidden />
              {mobileQrCheckin ? "Card · Apple Pay · Google Pay" : t("payments_stripe")}
            </div>
            <div className="mt-1 text-xs text-neutral-500">{mobileQrCheckin ? "Pay with card or phone wallet." : t("payments_stripe_desc")}</div>
          </button>
        </div>
      </div>
    </div>
  )
}
