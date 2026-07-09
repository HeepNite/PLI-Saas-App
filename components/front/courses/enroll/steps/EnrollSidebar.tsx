"use client"
import React from "react"
import {
  Calendar as CalendarIcon,
  CalendarRange,
  CalendarDays,
  CalendarCheck,
  Camera,
  CreditCard,
  Building2,
  Tag,
  User,
  FileText,
  CheckCircle2,
} from "lucide-react"
import type { EnrollmentContact } from "@/components/front/courses/types"
import { resolveStepValid, type StepValidContext } from "@/components/front/courses/enroll/model/enroll-step-valid"
import type { EnrollStepKey } from "@/lib/checkin/enroll-flow"
import type { I18nKey } from "@/lib/i18n-dict"

type Step = { key: EnrollStepKey; label: string }

export type EnrollSidebarProps = {
  isInline: boolean
  success: boolean
  isQrMobileCompactFlow: boolean
  isKioskTerminalFlow: boolean
  activeStepKey: string
  step: number
  steps: Step[]
  course: {
    title: string
    slug: string
    enrollment: {
      services: Array<{ id: string; label: string }>
      packages: Array<{ id: string; label: string }>
      addons?: Array<{ id: string; label: string }>
    }
  }
  service: string
  pkg: string
  addons: string[]
  participants: number
  contact: EnrollmentContact
  summaryDateTimeValue: React.ReactNode
  summaryGridClass: string
  total: number
  googleCalHref: string
  icsDataUri: string
  eventDates: boolean
  courseSlug: string
  date: string
  time: string
  stepValidCtx: StepValidContext
  onStepClick: (index: number) => void
  t: (key: I18nKey) => string
}

const stepIconMap: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>> = {
  party: User,
  datetime: CalendarIcon,
  info: FileText,
  photo: Camera,
  packages: Building2,
  promo: Tag,
  consecutive: CalendarCheck,
  payments: CreditCard,
  review: CheckCircle2,
}

export default function EnrollSidebar({
  isInline,
  success,
  isQrMobileCompactFlow,
  isKioskTerminalFlow,
  activeStepKey,
  step,
  steps,
  course,
  service,
  pkg,
  addons,
  participants,
  contact,
  summaryDateTimeValue,
  summaryGridClass,
  total,
  googleCalHref,
  icsDataUri,
  eventDates,
  courseSlug,
  date,
  time,
  stepValidCtx,
  onStepClick,
  t,
}: EnrollSidebarProps) {
  const stepValid = (index: number) => resolveStepValid(index, stepValidCtx)

  return (
    <aside
      className={[
        "bg-neutral-900/90 text-white p-3 sm:p-4 space-y-3 sm:space-y-4",
        isInline ? "md:col-span-1" : "md:col-span-5",
      ].join(" ")}
    >
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
                download={`pli-${courseSlug}-${date}-${time}.ics`}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
              >
                <CalendarRange className="h-4 w-4" aria-hidden />
                Outlook
              </a>
              <a
                href={icsDataUri}
                download={`pli-${courseSlug}-${date}-${time}.ics`}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                Yahoo
              </a>
              <a
                href={icsDataUri}
                download={`pli-${courseSlug}-${date}-${time}.ics`}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
              >
                <CalendarCheck className="h-4 w-4" aria-hidden />
                Apple
              </a>
            </div>
          ) : (
            <p className="text-xs text-white/70">{t("calendarsHint")}</p>
          )}
        </div>
      ) : (
        <>
          <h4 className="text-sm font-semibold">{t("booking")}</h4>
          {isInline ? (
            <nav aria-label="Breadcrumb" className="mt-3">
              {(() => {
                const start = step <= 2 ? 0 : Math.max(steps.length - 3, 0)
                const visible = steps.slice(start, start + 3)
                const progressIndex = Math.max(0, Math.min(visible.length - 1, step - start))
                const progressPct =
                  visible.length > 1 ? (progressIndex / (visible.length - 1)) * 100 : 0
                const insetPct = 100 / (visible.length * 2)
                return (
                  <div className="relative">
                    <div
                      className="absolute top-[18px] h-px bg-white/15"
                      style={{ left: `${insetPct}%`, right: `${insetPct}%` }}
                    />
                    <div
                      className="absolute top-[18px] h-px bg-[color:var(--brand)] transition-[width] duration-500 ease-out"
                      style={{
                        left: `${insetPct}%`,
                        width: `calc((100% - ${insetPct * 2}%) * ${progressPct / 100})`,
                      }}
                    />
                    <div className="relative z-10 grid grid-cols-3 gap-3">
                      {visible.map((st, idx) => {
                        const realIndex = start + idx
                        const done = realIndex < step && stepValid(realIndex)
                        const active = realIndex === step
                        const canJump = realIndex <= step
                        const Icon = stepIconMap[st.key] ?? User
                        return (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => {
                              if (!canJump) return
                              onStepClick(realIndex)
                            }}
                            disabled={!canJump}
                            className={`flex flex-col items-center gap-2 text-[11px] transition ${
                              canJump ? "hover:text-white" : "cursor-not-allowed opacity-60"
                            }`}
                            aria-label={st.label}
                          >
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/95">
                              <span
                                className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                                  done
                                    ? "border-green-400/70 bg-green-500/20 text-green-200"
                                    : active
                                      ? "border-[color:var(--brand)] bg-[color:var(--brand)]/25 text-white"
                                      : "border-white/15 bg-white/5 text-white/50"
                                }`}
                              >
                                <Icon className="h-4 w-4" aria-hidden />
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </nav>
          ) : (
            <nav aria-label="Breadcrumb" className="mt-2 text-[11px] text-white/80 overflow-hidden">
              {(() => {
                const maxVisible = 3
                const start = Math.max(0, Math.min(step - 1, steps.length - maxVisible))
                const visible = steps.slice(start, start + maxVisible)
                return (
                  <div
                    className="flex items-center gap-1.5 transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(0)` }}
                  >
                    {visible.map((st, idx) => {
                      const realIndex = start + idx
                      const done = realIndex < step && stepValid(realIndex)
                      const active = realIndex === step
                      const canJump = realIndex <= step
                      return (
                        <React.Fragment key={st.key}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!canJump) return
                              onStepClick(realIndex)
                            }}
                            disabled={!canJump}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 transition whitespace-nowrap ${
                              active ? "border-white/40 bg-white/10" : "border-white/10 bg-transparent"
                            } ${canJump ? "hover:bg-white/10" : "opacity-60 cursor-not-allowed"}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-green-400" : active ? "bg-white" : "bg-white/30"}`} />
                            <span>{st.label}</span>
                          </button>
                          {idx < visible.length - 1 && <span className="text-white/30">/</span>}
                        </React.Fragment>
                      )
                    })}
                  </div>
                )
              })()}
            </nav>
          )}

          {activeStepKey !== "payments" && !isQrMobileCompactFlow ? (
            <>
              <div className="mt-4 rounded-md border border-white/10 p-3 text-xs hidden sm:block">
                <div className="font-semibold mb-2">{t("summary")}</div>
                <div className={summaryGridClass}>
                  <div className="space-y-2">
                    {isKioskTerminalFlow && (
                      <div className="break-words">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">Course</div>
                        <div className="mt-1 whitespace-normal break-words text-white/85">{course.title}</div>
                      </div>
                    )}
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("service")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{course.enrollment.services.find((s) => s.id === service)?.label || "—"}</div>
                    </div>
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("package")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{course.enrollment.packages.find((p) => p.id === pkg)?.label || "—"}</div>
                    </div>
                    {!!addons.length && (
                      <div className="break-words">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("extras")}</div>
                        <div className="mt-1 whitespace-normal break-words text-white/85">{addons.map((a) => course.enrollment.addons?.find((x) => x.id === a)?.label).filter(Boolean).join(", ")}</div>
                      </div>
                    )}
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("people")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{participants}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{isKioskTerminalFlow ? "Date/Time" : t("dateTime")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{summaryDateTimeValue}</div>
                    </div>
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("email")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{contact.email || "—"}</div>
                    </div>
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("total")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85"><span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 sm:hidden">
                <details className="rounded-md border border-white/10 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold list-none">{t("summary")}</summary>
                  <div className="mt-2 space-y-2">
                    {isKioskTerminalFlow && (
                      <div className="break-words">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">Course</div>
                        <div className="mt-1 whitespace-normal break-words text-white/85">{course.title}</div>
                      </div>
                    )}
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("service")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{course.enrollment.services.find((s) => s.id === service)?.label || "—"}</div>
                    </div>
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("package")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{course.enrollment.packages.find((p) => p.id === pkg)?.label || "—"}</div>
                    </div>
                    {!!addons.length && (
                      <div className="break-words">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("extras")}</div>
                        <div className="mt-1 whitespace-normal break-words text-white/85">{addons.map((a) => course.enrollment.addons?.find((x) => x.id === a)?.label).filter(Boolean).join(", ")}</div>
                      </div>
                    )}
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("people")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{participants}</div>
                    </div>
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{isKioskTerminalFlow ? "Date/Time" : t("dateTime")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{summaryDateTimeValue}</div>
                    </div>
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("email")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85">{contact.email || "—"}</div>
                    </div>
                    <div className="break-words">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{t("total")}</div>
                      <div className="mt-1 whitespace-normal break-words text-white/85"><span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
                    </div>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <div className="mt-4 space-y-4">
              {!isQrMobileCompactFlow && (
                <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-center">
                  <p className="text-white/60">After completing your booking, you&apos;ll be able to add it to your calendar</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
