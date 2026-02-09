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
  minDate?: string // YYYY-MM-DD, opcional
  availableWeekdays?: number[] // 0=Mon ... 6=Sun; si se pasa, sólo esos días quedan habilitados
  allowClear?: boolean
}

export default function CalendarPicker({ value, onChange, timezone, className = "", minDate, availableWeekdays, allowClear = false }: CalendarPickerProps) {
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

  const isDisabled = (d: Date) => {
    const iso = toISODate(d)
    const weekday = (d.getDay() + 6) % 7 // Mon=0
    if (availableWeekdays && availableWeekdays.length && !availableWeekdays.includes(weekday)) return true
    return iso < min
  }

  return (
    <div className={`rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 p-3 ${className}`}>
      <div className="mx-auto flex w-full max-w-[360px] flex-nowrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <select
              value={month}
              onChange={(e)=>setMonth(parseInt(e.target.value))}
              className="w-[120px] rounded-md border bg-white/80 dark:bg-white/10 px-3 py-1.5 pr-8 text-sm"
            >
              {MONTHS.map((m, i)=> <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="relative">
            <select
              value={year}
              onChange={(e)=>setYear(parseInt(e.target.value))}
              className="w-[86px] rounded-md border bg-white/80 dark:bg-white/10 px-3 py-1.5 pr-8 text-sm"
            >
              {years.map(y=> <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" aria-label="Mes anterior" onClick={()=>go(-1)} className="h-8 w-8 rounded-md border">‹</button>
          <button type="button" aria-label="Mes siguiente" onClick={()=>go(1)} className="h-8 w-8 rounded-md border">›</button>
          {allowClear && (
            <button
              type="button"
              aria-label="Clear date"
              onClick={() => onChange("")}
              className="h-8 px-2.5 rounded-md border text-xs bg-white/70 dark:bg-white/10"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex justify-center text-xs">
        <span className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-1">{tz}</span>
      </div>

      <div className="mx-auto mt-3 grid max-w-[360px] grid-cols-7 gap-1 text-center text-xs">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((w)=>(
          <div key={w} className="py-1 text-neutral-500 dark:text-neutral-400">{w}</div>
        ))}
        {weeks.flat().map((d, idx)=>{
          if (!d) return <div key={idx} className="py-2" />
          const iso = toISODate(d)
          const selected = value === iso
          const disabled = isDisabled(d)
          const isToday = iso === todayISO
          const handleClick = () => {
            if (disabled) return
            if (selected && allowClear) onChange("")
            else onChange(iso)
          }
          return (
            <button
              key={idx}
              type="button"
              onClick={handleClick}
              disabled={disabled}
              className={`py-2 rounded-md border text-sm transition-colors ${
                selected
                  ? "bg-[var(--brand,#b61616)] text-white border-transparent shadow-[0_0_0_2px_rgba(182,22,22,0.35)]"
                  : isToday
                    ? "border-[var(--brand,#b61616)] bg-white/10 text-white shadow-[0_0_0_1px_rgba(182,22,22,0.4)]"
                    : "border-black/15 dark:border-white/15"
              } ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-black/10 dark:hover:bg-white/10"}`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
