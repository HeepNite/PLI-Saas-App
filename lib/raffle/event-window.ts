// Pure closed-event rule (design.md D11). `eventDate` is stored as the
// America/New_York midnight that starts the event day, so adding the grace
// window is the end of that night in studio-local terms — no timezone math
// is needed at call time.
export const RAFFLE_EVENT_GRACE_MS = 24 * 60 * 60 * 1000

export const isRaffleEventClosed = (eventDate: Date, now: Date): boolean =>
  now.getTime() > eventDate.getTime() + RAFFLE_EVENT_GRACE_MS
