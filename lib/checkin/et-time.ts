/**
 * Parse the current hour and minute in America/New_York (ET),
 * independent of the device's local timezone.
 */
export function getEtHourMinute(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now)
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? 0),
  }
}

/**
 * Return today's date string (YYYY-MM-DD) in America/New_York.
 */
export function getEtDateIso(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now)
}
