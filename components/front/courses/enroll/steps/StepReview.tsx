"use client"
import React from "react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import type { EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import type { CourseEnrollmentData } from "@/components/front/courses/types"
import type { EnrollmentOption } from "@/constants/courses"
import type { I18nKey } from "@/lib/i18n-dict"

type StepReviewProps = {
  course: CourseEnrollmentData
  service: string
  pkg: string
  addons: string[]
  participants: number
  date: string
  time: string
  contact: EnrollmentContact
  paymentMethodLabel: string
  total: number
  pkgOpt: EnrollmentOption | undefined | null
  to12h: (value: string) => string
  t: (key: I18nKey) => string
}

export default function StepReview({
  course,
  service,
  pkg,
  addons,
  participants,
  date,
  time,
  contact,
  paymentMethodLabel,
  total,
  pkgOpt,
  to12h,
  t,
}: StepReviewProps) {
  return (
    <div className="space-y-4">
      <GlassyCard className="p-4">
        <div className="text-sm space-y-1">
          <div className="font-medium">{t("reviewAndConfirm")}</div>
          <div>{t("course")}: {course.title}</div>
          <div>{t("service")}: {course.enrollment.services.find((s) => s.id === service)?.label}{pkgOpt ? " (included in package)" : ""}</div>
          <div>{t("package")}: {course.enrollment.packages.find((p) => p.id === pkg)?.label || "—"}</div>
          {!!addons.length && <div>{t("extras")}: {addons.map((a) => course.enrollment.addons?.find((x) => x.id === a)?.label).filter(Boolean).join(", ")}</div>}
          <div>{t("people")}: {participants}</div>
          <div>{t("dateTime")}: {date} {to12h(time)}</div>
          <div>{t("name")}: {`${contact.firstName} ${contact.lastName}`.trim() || "—"}</div>
          <div>{t("email")}: {contact.email || "—"}</div>
          <div>Phone: {contact.phone || "—"}</div>
          <div>{t("paymentMethod")}: {paymentMethodLabel}</div>
          {contact.note && <div>{t("notes")}: {contact.note}</div>}
          <div className="pt-2">{t("estimatedTotal")}: <span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
        </div>
      </GlassyCard>
    </div>
  )
}
