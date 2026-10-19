export type October2026RaffleDay = "30" | "31"

export type October2026RaffleEvent = {
  day: October2026RaffleDay
  slug: string
  title: string
  tabletPath: `/rifa/${October2026RaffleDay}`
  drawAt: string
}

const OCTOBER_2026_RAFFLE_EVENTS: Record<October2026RaffleDay, October2026RaffleEvent> = {
  "30": {
    day: "30",
    slug: "october-30-raffle-2026",
    title: "October 30 Raffle",
    tabletPath: "/rifa/30",
    drawAt: "2026-10-31T04:00:00.000Z",
  },
  "31": {
    day: "31",
    slug: "october-31-raffle-2026",
    title: "October 31 Raffle",
    tabletPath: "/rifa/31",
    drawAt: "2026-11-01T04:00:00.000Z",
  },
}

export function getOctober2026RaffleEvent(day: string): October2026RaffleEvent | null {
  return day === "30" || day === "31" ? OCTOBER_2026_RAFFLE_EVENTS[day] : null
}
