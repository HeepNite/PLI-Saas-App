"use client"
import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { CourseEnrollmentData } from "@/components/front/courses/types"
import type { I18nKey } from "@/lib/i18n-dict"

type Props = {
  course: CourseEnrollmentData
  date: string
  time: string
  service: string
  contact: EnrollmentContact
  successMessage: string | null
  total: number
  paymentMethodLabel: string
  allowPanelAccess: boolean
  isPersonalCompletion: boolean
  isStationCompletion: boolean
  stationCompletionTimeoutRef: React.MutableRefObject<number | null>
  onCompletedAction?: () => void | Promise<void>
  handleClose: () => void
  to12h: (value: string) => string
  t: (key: I18nKey) => string
}

export default function EnrollSuccessView({
  course, date, time, service, contact, successMessage, total, paymentMethodLabel,
  allowPanelAccess, isPersonalCompletion, isStationCompletion, stationCompletionTimeoutRef,
  onCompletedAction, handleClose, to12h, t,
}: Props) {
  const router = useRouter()
  return (
    <div className="mt-2">
      <div className="flex flex-col items-center py-4">
        <div className="mb-2" aria-hidden>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">🎉</span>
        </div>
        <h3 className="text-xl font-semibold">{t("congratulations")}</h3>
        <p className="text-xs text-neutral-500">{t("appointmentId")} {Math.abs((date+time).split("").reduce((a,c)=>a+c.charCodeAt(0),0)%1000) || 56}</p>
        {successMessage && (
          <p className="mt-3 max-w-md text-center text-sm text-neutral-600 dark:text-neutral-300">{successMessage}</p>
        )}
      </div>
      <div className="divide-y divide-black/10 dark:divide-white/10">
        <div className="grid grid-cols-2 gap-2 py-3 text-sm"><div className="text-neutral-500">{t("date")}</div><div className="text-right">{date}</div></div>
        <div className="grid grid-cols-2 gap-2 py-3 text-sm"><div className="text-neutral-500">{t("localTime")}</div><div className="text-right">{to12h(time)}</div></div>
        <div className="grid grid-cols-2 gap-2 py-3 text-sm"><div className="text-neutral-500">{t("classWord")}:</div><div className="text-right">{course.title} — {course.enrollment.services.find((s)=>s.id===service)?.label}</div></div>
        <div className="grid grid-cols-2 gap-2 py-3 text-sm"><div className="text-neutral-500">{t("teacher")}</div><div className="text-right">{course.instructors?.[0]?.name || "—"}</div></div>
        <div className="grid grid-cols-2 gap-2 py-3 text-sm"><div className="text-neutral-500">{t("location")}</div><div className="text-right">{course.location?.address}</div></div>
        <div className="grid grid-cols-2 gap-2 py-3 text-sm"><div className="text-neutral-500">{t("payment")}</div><div className="text-right">${total.toFixed(2)} — {paymentMethodLabel}</div></div>
      </div>
      <hr className="my-3 border-black/10 dark:border-white/10" />
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2"><div className="text-neutral-500">{t("name")}:</div><div className="text-right">{`${contact.firstName} ${contact.lastName}`.trim() || "—"}</div></div>
        <div className="grid grid-cols-2 gap-2"><div className="text-neutral-500">{t("email")}</div><div className="text-right">{contact.email}</div></div>
      </div>
      <div className={`mt-6 border-t border-black/10 dark:border-white/10 px-3 py-3 flex items-center ${(allowPanelAccess || isPersonalCompletion) ? "justify-between" : "justify-end"}`}>
        {allowPanelAccess && (
          <Link href="/client-profile" className="text-sm font-medium">{t("customerPanel")}</Link>
        )}
        {isPersonalCompletion && (
          <button type="button" onClick={() => router.push("/client-profile")} className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10">
            Go to my account
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (isStationCompletion && onCompletedAction) {
              if (stationCompletionTimeoutRef.current !== null) {
                window.clearTimeout(stationCompletionTimeoutRef.current)
                stationCompletionTimeoutRef.current = null
              }
              void onCompletedAction()
              return
            }
            handleClose()
          }}
          className="px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white"
        >
          {isStationCompletion ? t("finish") : isPersonalCompletion ? "Close" : t("finish")}
        </button>
      </div>
    </div>
  )
}
