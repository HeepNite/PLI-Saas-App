"use client"
import React from "react"
import {
  getCalendarRangePosition,
  isCalendarDateWithinRange,
  resolveCalendarRangeSelection,
} from "./calendarPickerRange"

// CalendarPicker: pequeño calendario mensual con selects de mes/año y flechas prev/next.
// - Mantiene el estilo de la marca (bordes suaves, fondo glassy)
// - Devuelve una fecha en formato YYYY-MM-DD mediante onChange
// - Incluye chip de zona horaria como en el mockup

const MONTHS = [
  "January","February","March","April","May","June","July","August","September","October","November","December"
]

function pad(n: number) { return n.toString().padStart(2, "0") }
function toISODate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

export type CalendarPickerProps = {
  value?: string // YYYY-MM-DD
  onChange?: (value: string) => void // optional when rangeMode is used
  values?: string[] // selección múltiple (YYYY-MM-DD[])
  onValuesChange?: (values: string[]) => void
  multiple?: boolean
  timezone?: string
  className?: string
  compact?: boolean
  minDate?: string // YYYY-MM-DD, opcional
  availableWeekdays?: number[] // 0=Mon ... 6=Sun; si se pasa, sólo esos días quedan habilitados
  unavailableDates?: string[] // YYYY-MM-DD list, opcional
  isDateDisabled?: (isoDate: string) => boolean
  getDateDisabledReason?: (isoDate: string) => string | undefined
  getDateTooltip?: (isoDate: string) => string | undefined
  getDateTone?:
    | ((
        isoDate: string
      ) =>
        | "event"
        | "warning"
        | "course"
        | "program"
        | "workshop"
        | "convention"
        | "bootcamp"
        | undefined)
  allowClear?: boolean
  locked?: boolean
  rangeMode?: boolean
  rangeStart?: string
  rangeEnd?: string
  onRangeChange?: (rangeStart: string, rangeEnd?: string) => void
}

export default function CalendarPicker({
  value,
  onChange,
  values,
  onValuesChange,
  multiple = false,
  timezone,
  className = "",
  compact = false,
  minDate,
  availableWeekdays,
  unavailableDates,
  isDateDisabled,
  getDateDisabledReason,
  getDateTooltip,
  getDateTone,
  allowClear = false,
  locked = false,
  rangeMode = false,
  rangeStart,
  rangeEnd,
  onRangeChange,
}: CalendarPickerProps) {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  const fieldId = React.useId()

  // Mes/año visibles en el encabezado
  const initialValue = rangeMode ? (rangeStart || rangeEnd || value) : (value || rangeStart || rangeEnd)
  const initial = initialValue ? new Date(initialValue + "T00:00:00") : new Date()
  const [year, setYear] = React.useState<number>(initial.getFullYear())
  const [month, setMonth] = React.useState<number>(initial.getMonth()) // 0-11

  const todayISO = toISODate(new Date())
  const min = minDate || todayISO

  const firstDay = new Date(year, month, 1)
  const startWeekday = (firstDay.getDay() + 6) % 7 // Mon=0 ... Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const weeks: (Date | null)[][] = []
  let current: (Date | null)[] = new Array(startWeekday).fill(null)
  for (let day = 1; day <= daysInMonth; day++) {
    current.push(new Date(year, month, day))
    if (current.length === 7) { weeks.push(current); current = [] }
  }
  if (current.length) {
    while (current.length < 7) current.push(null)
    weeks.push(current)
  }

  const go = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setYear(y); setMonth(m)
  }

  const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 1 + i) // previous, current, +5
  const unavailable = React.useMemo(() => new Set(unavailableDates || []), [unavailableDates])
  const selectedValues = React.useMemo(() => new Set((values || []).filter(Boolean)), [values])

  const getToneClasses = React.useCallback((tone?: string) => {
    switch (tone) {
      case "course":
        return "border-[var(--brand,#b61616)]/65 bg-[var(--brand,#b61616)]/18 text-[var(--brand,#ffd1d1)] shadow-[0_0_0_1px_rgba(182,22,22,0.45)]"
      case "program":
        return "border-orange-400/65 bg-orange-400/15 text-orange-100 shadow-[0_0_0_1px_rgba(251,146,60,0.45)]"
      case "workshop":
        return "border-violet-400/65 bg-violet-500/18 text-violet-100 shadow-[0_0_0_1px_rgba(167,139,250,0.45)]"
      case "convention":
        return "border-fuchsia-400/65 bg-fuchsia-500/18 text-fuchsia-100 shadow-[0_0_0_1px_rgba(232,121,249,0.45)]"
      case "bootcamp":
        return "border-cyan-400/65 bg-cyan-500/18 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.45)]"
      case "event":
        return "border-amber-500/65 bg-amber-500/15 text-amber-100 shadow-[0_0_0_1px_rgba(245,158,11,0.45)]"
      case "warning":
        return "border-amber-500/60 bg-amber-500/12 text-amber-200 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
      default:
        return ""
    }
  }, [])

  const isDisabled = (d: Date) => {
    const iso = toISODate(d)
    const weekday = (d.getDay() + 6) % 7 // Mon=0
    if (availableWeekdays && availableWeekdays.length && !availableWeekdays.includes(weekday)) return true
    if (unavailable.has(iso)) return true
    if (isDateDisabled?.(iso)) return true
    return iso < min
  }

  return (
    <div
      className={`flex h-full w-full min-w-0 flex-col rounded-md border border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/10 ${
        compact ? "p-2 pt-3" : "p-3 pt-4 sm:p-5 lg:p-6"
      } ${className}`}
    >
      <div className="flex w-full items-center gap-2 md:gap-3">
        <div className="grid min-w-0 flex-1 items-center gap-2 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          {locked ? (
            <>
              <div className={`w-full min-w-0 px-1 text-sm font-medium text-black/80 dark:text-white/80 ${
                compact ? "py-1" : "py-1 md:py-1.5 md:text-base"
              }`}>
                {MONTHS[month]}
              </div>
              <div className={`w-full min-w-0 px-1 text-sm font-medium text-black/80 dark:text-white/80 ${
                compact ? "py-1" : "py-1 md:py-1.5 md:text-base"
              }`}>
                {year}
              </div>
            </>
          ) : (
            <>
              <div className="relative min-w-0">
                <select
                  id={`${fieldId}-month`}
                  name="calendarMonth"
                  aria-label="Month"
                  value={month}
                  onChange={(e)=>setMonth(parseInt(e.target.value))}
                  className={`w-full min-w-0 rounded-md border bg-white/80 dark:bg-white/10 px-3 pr-8 text-sm ${
                    compact ? "py-1.5" : "py-1.5 md:py-2 md:text-base"
                  }`}
                >
                  {MONTHS.map((m, i)=> <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="relative min-w-0">
                <select
                  id={`${fieldId}-year`}
                  name="calendarYear"
                  aria-label="Year"
                  value={year}
                  onChange={(e)=>setYear(parseInt(e.target.value))}
                  className={`w-full min-w-0 rounded-md border bg-white/80 dark:bg-white/10 px-3 pr-8 text-sm ${
                    compact ? "py-1.5" : "py-1.5 md:py-2 md:text-base"
                  }`}
                >
                  {years.map(y=> <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        {!locked && (
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              aria-label="Previous month"
              onClick={()=>go(-1)}
              className={`rounded-md border ${compact ? "h-8 w-8" : "h-8 w-8 md:h-10 md:w-10"}`}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={()=>go(1)}
              className={`rounded-md border ${compact ? "h-8 w-8" : "h-8 w-8 md:h-10 md:w-10"}`}
            >
              ›
            </button>
            {allowClear && (
              <button
                type="button"
                aria-label="Clear date"
                  onClick={() => {
                    if (multiple) {
                      onValuesChange?.([])
                    }
                    if (rangeMode && rangeStart) {
                      onRangeChange?.("")
                    }
                    onChange?.("")
                  }}
                className={`rounded-md border text-xs bg-white/70 dark:bg-white/10 ${
                  compact ? "h-8 px-2.5" : "h-8 md:h-10 px-2.5 md:px-3 md:text-sm"
                }`}
              >
                Clear
              </button>
            )}
          </div>
        )}
        <span className={`shrink-0 px-1 font-medium text-black/80 dark:text-white/80 ${compact ? "text-sm" : "text-sm md:text-base"}`}>{tz}</span>
      </div>

      <div className="mt-3 border-t border-black/10 dark:border-white/10" />
      <div
        className={`mt-2 grid w-full max-w-none flex-1 grid-cols-7 content-center text-center ${
          compact ? "gap-1.5 text-sm" : "gap-1 sm:gap-2 lg:gap-3 text-xs sm:text-sm lg:text-base"
        }`}
      >
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((w)=>(
          <div
            key={w}
            className={`text-neutral-500 dark:text-neutral-400 ${compact ? "py-1" : "py-1 sm:py-2 lg:py-3"}`}
          >
            {w}
          </div>
        ))}
        {weeks.flat().map((d, idx)=>{
          if (!d) return <div key={idx} className={compact ? "h-10" : "py-2"} />
          const iso = toISODate(d)
          const rangePosition = rangeMode
            ? getCalendarRangePosition(iso, rangeStart, rangeEnd)
            : null
          const inRange = rangeMode
            ? isCalendarDateWithinRange(iso, rangeStart, rangeEnd)
            : false
          const selected = rangeMode
            ? rangePosition === "single" || rangePosition === "start" || rangePosition === "end"
            : multiple
              ? selectedValues.has(iso)
              : value === iso
          const disabled = isDisabled(d)
          const disabledReason = disabled ? getDateDisabledReason?.(iso) : undefined
          const dateTooltip = getDateTooltip?.(iso)
          const dateTone = getDateTone?.(iso)
          const isToday = iso === todayISO
          const interactive = !locked
          const toneClasses = getToneClasses(dateTone)
          const handleClick = () => {
            if (!interactive) return
            if (disabled) return
            if (multiple) {
              const nextSet = new Set(selectedValues)
              if (nextSet.has(iso)) nextSet.delete(iso)
              else nextSet.add(iso)
              const nextValues = [...nextSet].sort()
              onValuesChange?.(nextValues)
              onChange?.(iso)
              return
            }
            if (rangeMode) {
              const nextRange = resolveCalendarRangeSelection(rangeStart, rangeEnd, iso)
              onRangeChange?.(nextRange.rangeStart || "", nextRange.rangeEnd)
              onChange?.(nextRange.rangeEnd || nextRange.rangeStart || iso)
              return
            }
            if (selected && allowClear) onChange?.("")
            else onChange?.(iso)
          }
          const rangeFillClass = rangeMode && inRange
            ? rangePosition === "single"
              ? "rounded-md md:rounded-lg"
              : rangePosition === "start"
                ? "rounded-l-md md:rounded-l-lg"
                : rangePosition === "end"
                  ? "rounded-r-md md:rounded-r-lg"
                  : "rounded-none"
            : ""
          return (
            <div
              key={idx}
              className={`relative group ${rangeMode && inRange && rangePosition !== "single" ? "before:absolute before:inset-y-1 before:bg-[var(--brand,#b61616)]/12 before:content-[''] before:pointer-events-none" : ""} ${rangeMode && inRange && rangePosition === "start" ? "before:left-1/2 before:right-0" : ""} ${rangeMode && inRange && rangePosition === "end" ? "before:left-0 before:right-1/2" : ""} ${rangeMode && inRange && rangePosition === "middle" ? "before:left-0 before:right-0" : ""}`}
              data-range-position={rangePosition || undefined}
            >
              <button
                type="button"
                onClick={handleClick}
                disabled={interactive ? disabled : false}
                data-range-highlight={inRange ? "true" : undefined}
                className={`rounded-md md:rounded-lg border transition-colors flex items-center justify-center ${
                  compact ? "h-10 w-full text-sm" : "w-full py-2 sm:py-3 lg:py-4 text-sm sm:text-base lg:text-lg"
                } ${
                  selected
                    ? toneClasses || "bg-[var(--brand,#b61616)] text-white border-transparent shadow-[0_0_0_2px_rgba(182,22,22,0.35)]"
                    : rangeMode && inRange
                      ? "border-[var(--brand,#b61616)]/25 bg-[var(--brand,#b61616)]/8 text-inherit"
                    : toneClasses
                      ? toneClasses
                    : dateTooltip
                      ? "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)] shadow-[0_0_0_1px_rgba(182,22,22,0.3)]"
                    : isToday
                      ? "border-[var(--brand,#b61616)] bg-white/10 text-white shadow-[0_0_0_1px_rgba(182,22,22,0.4)]"
                      : "border-black/15 dark:border-white/15"
                } ${
                  !interactive
                    ? "cursor-default"
                    : disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-black/10 dark:hover:bg-white/10"
                } ${rangeFillClass}`}
              >
                {d.getDate()}
              </button>
              {(disabled && disabledReason) || (!disabled && dateTooltip) ? (
                <div className="pointer-events-none absolute left-1/2 top-0 z-40 min-w-[16rem] -translate-x-1/2 -translate-y-[110%] rounded-lg border border-white/20 bg-[#151017]/95 px-3 py-2 text-[12px] font-medium text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                  {disabled ? disabledReason : dateTooltip}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
