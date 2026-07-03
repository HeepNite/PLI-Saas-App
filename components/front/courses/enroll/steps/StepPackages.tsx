"use client"
import React from "react"
import type { CourseEnrollmentData } from "@/components/front/courses/types"
import { formatEnrollmentOptionPrice } from "@/components/front/courses/utils/package-pricing"
import type { EnrollmentOption } from "@/constants/courses"

type StepPackagesProps = {
  isCheckInNewFlow: boolean
  isQrMobileCompactFlow: boolean
  course: CourseEnrollmentData
  pkg: string
  setPkg: (value: React.SetStateAction<string>) => void
  to12h: (value: string) => string
  time: string
  formatPackageMeta: (option?: EnrollmentOption | null) => string | undefined
}

export default function StepPackages({
  isCheckInNewFlow,
  isQrMobileCompactFlow,
  course,
  pkg,
  setPkg,
  to12h,
  time,
  formatPackageMeta,
}: StepPackagesProps) {
  return (
    <div className="space-y-4">
      <div className={`grid gap-2.5 ${course.enrollment.packages.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {course.enrollment.packages.map((p, index) => {
          const selected = pkg === p.id
          const metaLine = formatPackageMeta(p)
          const descriptionLine = p.description || metaLine
          const shouldShowMetaLine = Boolean(p.description && metaLine && metaLine !== p.description)
          const packageCardBackgrounds = [
            "bg-[radial-gradient(circle_at_top_left,rgba(182,22,22,0.28),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_34%),linear-gradient(145deg,rgba(38,40,52,0.96),rgba(17,19,28,0.98))]",
            "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(182,22,22,0.18),transparent_36%),linear-gradient(145deg,rgba(48,49,55,0.94),rgba(20,21,28,0.98))]",
            "bg-[radial-gradient(circle_at_top_left,rgba(182,22,22,0.22),transparent_34%),radial-gradient(circle_at_center_right,rgba(255,255,255,0.09),transparent_38%),linear-gradient(145deg,rgba(50,48,54,0.95),rgba(19,18,25,0.99))]",
          ]
          const packageCardBackground = packageCardBackgrounds[index % packageCardBackgrounds.length]
          const isLastOddPackage = course.enrollment.packages.length > 1 &&
            course.enrollment.packages.length % 2 === 1 &&
            index === course.enrollment.packages.length - 1
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPkg(selected ? "" : p.id)}
              className={`relative min-h-[7rem] w-full overflow-hidden rounded-[1.1rem] border px-3.5 py-3.5 text-left shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)] transition ${isLastOddPackage ? "col-span-2" : ""} ${packageCardBackground} ${
                selected
                  ? "border-[rgba(220,38,38,0.72)] ring-2 ring-[rgba(182,22,22,0.38)]"
                  : "border-white/14 hover:border-white/24 hover:brightness-110"
              }`}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
              <div className="relative flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold uppercase tracking-[-0.01em] text-white leading-tight">{p.label}</p>
                  {p.price != null && (
                    <p className="shrink-0 text-right text-lg font-semibold text-white">{formatEnrollmentOptionPrice(p.price)}</p>
                  )}
                </div>
                {descriptionLine && (
                  <p className="w-full text-xs leading-snug text-white/68 line-clamp-2">{descriptionLine}</p>
                )}
                {shouldShowMetaLine && (
                  <p className="mt-auto w-full text-[11px] text-white/48">{metaLine}</p>
                )}
              </div>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setPkg("")}
          className={`relative min-h-[7rem] w-full overflow-hidden rounded-[1.1rem] border px-3.5 py-3.5 text-left shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)] transition ${course.enrollment.packages.length > 1 ? "col-span-2" : ""} bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(182,22,22,0.22),transparent_36%),linear-gradient(145deg,rgba(38,40,52,0.96),rgba(17,19,28,0.98))] ${
            !pkg
              ? "border-[rgba(220,38,38,0.72)] ring-2 ring-[rgba(182,22,22,0.38)]"
              : "border-white/14 hover:border-white/24 hover:brightness-110"
          }`}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
          <div className="relative flex h-full flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[-0.01em] text-white">Drop-in</p>
                <p className="mt-0.5 text-[11px] text-white/50">{course.title} / {to12h(time)}</p>
              </div>
              <p className="shrink-0 text-right text-lg font-semibold text-white">${(isCheckInNewFlow || isQrMobileCompactFlow) ? "15" : "20"}</p>
            </div>
            <p className="w-full text-xs leading-snug text-white/68">
              {isCheckInNewFlow ? "First-time student single class." : "Single class without a package."}
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}
