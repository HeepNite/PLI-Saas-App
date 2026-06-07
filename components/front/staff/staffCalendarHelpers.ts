export const monthKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`

export const toDateKey = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

export const buildCalendar = (year: number, monthIndex: number) => {
  const firstDay = new Date(year, monthIndex, 1)
  const offset = firstDay.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate()

  const cells: Array<{ day: number; dateKey: string; inMonth: boolean }> = []

  for (let i = offset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1
    const prevYear = monthIndex === 0 ? year - 1 : year
    cells.push({ day, dateKey: toDateKey(prevYear, prevMonth, day), inMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, dateKey: toDateKey(year, monthIndex, day), inMonth: true })
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (offset + daysInMonth) + 1
    const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1
    const nextYear = monthIndex === 11 ? year + 1 : year
    cells.push({ day: nextDay, dateKey: toDateKey(nextYear, nextMonth, nextDay), inMonth: false })
  }

  return cells
}

export const startOfDay = (value: Date) => {
  const out = new Date(value)
  out.setHours(0, 0, 0, 0)
  return out
}

export const previousWeekday = (base: Date, weekday: number) => {
  const out = startOfDay(base)
  const diff = (out.getDay() - weekday + 7) % 7
  out.setDate(out.getDate() - diff)
  return out
}
