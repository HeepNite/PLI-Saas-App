import { parseQrCheckInContext } from "@/lib/checkin/qr"

const SAFE_QR_EXTRA_PARAMS = new Set(["fromQr", "scan", "entry", "device", "terminal"])

export function resolveSafeQrRedirect(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined

  const candidate = raw.trim()
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return undefined

  const parsed = new URL(candidate, "https://pli.internal")
  if (parsed.pathname !== "/checkin" || parsed.hash) return undefined

  const courseSlug = parsed.searchParams.get("courseSlug")?.trim() ?? ""
  const date = parsed.searchParams.get("date")?.trim() ?? ""
  const time = parsed.searchParams.get("time")?.trim() ?? ""
  const durationMinutes = parsed.searchParams.get("durationMinutes")?.trim()

  const context = parseQrCheckInContext({
    courseSlug,
    date,
    time,
    durationMinutes,
  })

  if ("error" in context) return undefined

  const safeParams = new URLSearchParams()
  safeParams.set("courseSlug", courseSlug)
  safeParams.set("date", date)
  safeParams.set("time", time)

  if (durationMinutes) {
    safeParams.set("durationMinutes", durationMinutes)
  }

  for (const [key, value] of parsed.searchParams.entries()) {
    if (!SAFE_QR_EXTRA_PARAMS.has(key)) continue

    const trimmedValue = value.trim()
    if (!trimmedValue) continue

    safeParams.set(key, trimmedValue)
  }

  return `/checkin?${safeParams.toString()}`
}
