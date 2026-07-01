"use client"
import React from "react"
import { type EnrollmentOption } from "@/constants/courses"
import type { CourseEnrollmentData } from "@/components/front/courses/types"
import { formatEnrollmentOptionPrice } from "@/components/front/courses/utils/package-pricing"
import type { I18nKey } from "@/lib/i18n-dict"

type StepPartyProps = {
  isInline: boolean
  isCheckInNewFlow: boolean
  isNewStudent: boolean
  hasNewStudentService: boolean
  availableServices: EnrollmentOption[]
  course: CourseEnrollmentData
  service: string
  setService: (value: React.SetStateAction<string>) => void
  participants: number
  setParticipants: (value: React.SetStateAction<number>) => void
  pkg: string
  setPkg: (value: React.SetStateAction<string>) => void
  addons: string[]
  setAddons: React.Dispatch<React.SetStateAction<string[]>>
  formatPackageMeta: (option?: EnrollmentOption | null) => string | undefined
  t: (key: I18nKey) => string
}

export default function StepParty({
  isInline,
  isCheckInNewFlow,
  isNewStudent,
  hasNewStudentService,
  availableServices,
  course,
  service,
  setService,
  participants,
  setParticipants,
  pkg,
  setPkg,
  addons,
  setAddons,
  formatPackageMeta,
  t,
}: StepPartyProps) {
  const toggleAddon = (id: string) => {
    setAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-5">
      <div className={`grid gap-3 ${isInline ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">{t("label_service")}</label>
          <select
            id="booking-service"
            name="booking-service"
            value={service}
            onChange={(e) => {
              if (isCheckInNewFlow && hasNewStudentService) return
              setService(e.target.value)
            }}
            disabled={isCheckInNewFlow && hasNewStudentService}
            className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 disabled:opacity-70"
          >
            {availableServices.map((s) => (
              <option key={s.id} value={s.id}>{s.label}{s.price ? ` — $${s.price}` : ""}</option>
            ))}
          </select>
          {isCheckInNewFlow && hasNewStudentService && (
            <p className="text-xs text-neutral-500">Service preselected for new students.</p>
          )}
        </fieldset>
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">{t("label_companion")}</label>
          <select
            value={participants}
            onChange={(e) => setParticipants(parseInt(e.target.value) || 1)}
            disabled={isNewStudent}
            className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 disabled:opacity-60"
          >
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? t("onePerson") : t("manyPeople")}</option>)}
          </select>
          {isNewStudent && (
            <p className="text-xs text-neutral-500">{t("new_student_single_notice")}</p>
          )}
        </fieldset>
      </div>

      {!!course.enrollment.packages.length && (
        <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{t("optionalPackages")}</h4>
            {pkg && (
              <button type="button" onClick={() => setPkg("")} className="text-xs underline">
                {t("removeSelection")}
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{t("packagesHint")}</p>
          <div className={`mt-3 grid gap-2 ${isInline ? "grid-cols-2 auto-rows-fr" : "grid-cols-1 sm:grid-cols-2"}`}>
            {course.enrollment.packages.map((p) => {
              const selected = pkg === p.id
              const metaLine = formatPackageMeta(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPkg(p.id)}
                  className={`h-full rounded-md border px-3 py-3 text-left transition ${
                    selected
                      ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.12)] text-white"
                      : "border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 text-neutral-700 dark:text-white/80 hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{p.label}</span>
                    {p.price != null && <span className="text-sm font-semibold">{formatEnrollmentOptionPrice(p.price)}</span>}
                  </div>
                  {metaLine && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-white/60">{metaLine}</p>
                  )}
                  {p.description && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-white/60">{p.description}</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!!course.enrollment.addons?.length && (
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">{t("label_extras")}</label>
          <div className="grid grid-cols-1 gap-2">
            {course.enrollment.addons!.map((a) => (
              <label
                key={a.id}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm"
              >
                <span>{a.label}{a.price ? ` — $${a.price}` : ""}</span>
                <input type="checkbox" checked={addons.includes(a.id)} onChange={() => toggleAddon(a.id)} className="h-4 w-4 shrink-0" />
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  )
}
