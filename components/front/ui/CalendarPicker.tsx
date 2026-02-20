"use client"
import React from "react"

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
  onChange: (value: string) => void
  timezone?: string
  className?: string
  compact?: boolean
  minDate?: string // YYYY-MM-DD, opcional
  availableWeekdays?: number[] // 0=Mon ... 6=Sun; si se pasa, sólo esos días quedan habilitados
  unavailableDates?: string[] // YYYY-MM-DD list, opcional
  isDateDisabled?: (isoDate: string) => boolean
  getDateDisabledReason?: (isoDate: string) => string | undefined
  allowClear?: boolean
}

export default function CalendarPicker({
  value,
  onChange,
  timezone,
  className = "",
  compact = false,
  minDate,
  availableWeekdays,
  unavailableDates,
  isDateDisabled,
  getDateDisabledReason,
  allowClear = false,
}: CalendarPickerProps) {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

  // Mes/año visibles en el encabezado
  const initial = value ? new Date(value + "T00:00:00") : new Date()
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
      className={`rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 ${
        compact ? "p-3" : "p-3 sm:p-5 lg:p-6"
      } ${className}`}
    >
      <div className="mx-auto grid w-full max-w-none grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:gap-3">
        <div className={`grid min-w-0 items-center gap-2 ${compact ? "grid-cols-[minmax(0,1fr)_98px]" : "grid-cols-[minmax(0,1fr)_122px]"}`}>
          <div className="relative min-w-0">
            <select
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
              value={year}
              onChange={(e)=>setYear(parseInt(e.target.value))}
              className={`w-full min-w-0 rounded-md border bg-white/80 dark:bg-white/10 px-3 pr-8 text-sm ${
                compact ? "py-1.5" : "py-1.5 md:py-2 md:text-base"
              }`}
            >
              {years.map(y=> <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={()=>go(-1)}
            className={`rounded-md border ${compact ? "h-8 w-8" : "h-8 w-8 md:h-10 md:w-10"}`}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={()=>go(1)}
            className={`rounded-md border ${compact ? "h-8 w-8" : "h-8 w-8 md:h-10 md:w-10"}`}
          >
            ›
          </button>
          {allowClear && (
            <button
              type="button"
              aria-label="Clear date"
              onClick={() => onChange("")}
              className={`rounded-md border text-xs bg-white/70 dark:bg-white/10 ${
                compact ? "h-8 px-2.5" : "h-8 md:h-10 px-2.5 md:px-3 md:text-sm"
              }`}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className={`mt-3 flex justify-center ${compact ? "text-xs" : "text-xs sm:text-sm"}`}>
        <span className={`rounded-full bg-black/5 dark:bg-white/10 px-2 py-1 ${compact ? "" : "md:px-3"}`}>{tz}</span>
      </div>

      <div
        className={`mx-auto mt-4 grid w-full max-w-none grid-cols-7 text-center ${
          compact ? "gap-1 text-xs" : "gap-1 sm:gap-2 lg:gap-3 text-xs sm:text-sm lg:text-base"
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
          if (!d) return <div key={idx} className="py-2" />
          const iso = toISODate(d)
          const selected = value === iso
          const disabled = isDisabled(d)
          const disabledReason = disabled ? getDateDisabledReason?.(iso) : undefined
          const isToday = iso === todayISO
          const handleClick = () => {
            if (disabled) return
            if (selected && allowClear) onChange("")
            else onChange(iso)
          }
          return (
            <div key={idx} className="relative group">
              <button
                type="button"
                onClick={handleClick}
                disabled={disabled}
                className={`w-full rounded-md md:rounded-lg border transition-colors ${
                  compact ? "py-2 text-sm" : "py-2 sm:py-3 lg:py-4 text-sm sm:text-base lg:text-lg"
                } ${
                  selected
                    ? "bg-[var(--brand,#b61616)] text-white border-transparent shadow-[0_0_0_2px_rgba(182,22,22,0.35)]"
                    : isToday
                      ? "border-[var(--brand,#b61616)] bg-white/10 text-white shadow-[0_0_0_1px_rgba(182,22,22,0.4)]"
                      : "border-black/15 dark:border-white/15"
                } ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-black/10 dark:hover:bg-white/10"}`}
              >
                {d.getDate()}
              </button>
              {disabled && disabledReason && (
                <div className="pointer-events-none absolute left-1/2 top-0 z-40 min-w-[16rem] -translate-x-1/2 -translate-y-[110%] rounded-lg border border-white/20 bg-[#151017]/95 px-3 py-2 text-[12px] font-medium text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                  {disabledReason}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
