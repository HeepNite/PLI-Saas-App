"use client"
import React from "react"
import CalendarPicker from "@/components/front/ui/CalendarPicker"
import type { I18nKey } from "@/lib/i18n-dict"

type StepDateTimeProps = {
  isInline: boolean
  isCheckInFlow: boolean
  date: string
  setDate: React.Dispatch<React.SetStateAction<string>>
  time: string
  setTime: React.Dispatch<React.SetStateAction<string>>
  initialLoading: boolean
  timeLoading: boolean
  setTimeLoading: React.Dispatch<React.SetStateAction<boolean>>
  checkInScheduleNotice: string | null
  setCheckInScheduleNotice: React.Dispatch<React.SetStateAction<string | null>>
  visibleTimeSlots: readonly string[]
  isSlotExpiredForCheckIn: (slot: string) => boolean
  to12h: (value: string) => string
  getCurrentCourseTimesForDate: (dateIso: string) => string[]
  courseAvailableWeekdays: number[] | undefined
  t: (key: I18nKey) => string
}

export default function StepDateTime({
  isInline,
  isCheckInFlow,
  date,
  setDate,
  time,
  setTime,
  initialLoading,
  timeLoading,
  setTimeLoading,
  checkInScheduleNotice,
  setCheckInScheduleNotice,
  visibleTimeSlots,
  isSlotExpiredForCheckIn,
  to12h,
  getCurrentCourseTimesForDate,
  courseAvailableWeekdays,
  t,
}: StepDateTimeProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <fieldset className="space-y-2">
        <label className="text-sm font-medium">{t("step_datetime")}</label>
        {initialLoading ? (
          <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3">
            <div className="h-4 w-24 rounded-full shimmer" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 21 }).map((_, idx) => (
                <div key={idx} className="h-8 rounded-md shimmer" />
              ))}
            </div>
          </div>
        ) : (
          <CalendarPicker
            value={date}
            onChange={(d) => {
              if (isCheckInFlow) return
              setDate(d)
              if (!d) {
                setTime("")
                setTimeLoading(false)
                setCheckInScheduleNotice(null)
                return
              }
              const nextSlots = getCurrentCourseTimesForDate(d)
              setTime(nextSlots[0] || "")
              setCheckInScheduleNotice(null)
              setTimeLoading(true)
              window.setTimeout(() => setTimeLoading(false), 350)
            }}
            compact={isInline}
            className="w-full"
            timezone={isCheckInFlow ? "America/New_York" : undefined}
            availableWeekdays={courseAvailableWeekdays}
            allowClear={!isCheckInFlow}
            locked={isCheckInFlow}
          />
        )}
      </fieldset>
      <fieldset className="space-y-2">
        <label className="text-sm font-medium">{t("label_selectTime")}</label>
        {date ? (
          <div className="flex flex-wrap gap-2">
            {timeLoading ? (
              <>
                <div className="h-9 w-24 rounded-md shimmer" />
                <div className="h-9 w-24 rounded-md shimmer" />
                <div className="h-9 w-24 rounded-md shimmer" />
              </>
            ) : (
              <>
                {visibleTimeSlots.map((tSlot) => {
                  const slotExpired = isSlotExpiredForCheckIn(tSlot)
                  const isLocked = isCheckInFlow
                  return (
                    <button
                      type="button"
                      key={tSlot}
                      onClick={() => {
                        if (isLocked) return
                        setTime(tSlot)
                      }}
                      disabled={slotExpired}
                      className={`px-3 py-1.5 rounded-md border text-sm ${
                        time === tSlot
                          ? "bg-[var(--brand,#111)] text-white border-transparent"
                          : "border-black/10 dark:border-white/10"
                      } ${
                        slotExpired
                          ? "opacity-40 cursor-not-allowed"
                          : isLocked
                            ? "cursor-default"
                            : ""
                      }`}
                    >
                      {to12h(tSlot)}
                    </button>
                  )
                })}
                {visibleTimeSlots.length === 0 && (
                  <p className="text-xs text-muted-foreground">No time slots available for this day.</p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Select a date to view available times.</p>
            <div className="h-3 w-32 rounded-full shimmer" />
            <div className="h-3 w-24 rounded-full shimmer" />
          </div>
        )}
        {isCheckInFlow && checkInScheduleNotice && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {checkInScheduleNotice}
          </div>
        )}
      </fieldset>
    </div>
  )
}
