import { NextResponse } from "next/server"
import { getNativeAttemptState } from "@/lib/checkout/native-attempt-state"
import { resolveKioskEffectiveSessionDateTime } from "@/lib/checkout/kiosk-context"
import { validateCheckoutPayload, type CheckoutBody } from "@/lib/checkout/validation"
import { resolveTerminalKioskSession } from "@/lib/checkin/kiosk-session"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { FLOW_CONTEXT } from "@/lib/payment-constants"

const headers = { "Cache-Control": "no-store" }
const reject = (status: number) => NextResponse.json({ error: "Native attempt state unavailable" }, { status, headers })
const unresolved = () => NextResponse.json({ state: "payment_unresolved" }, { headers })
const bodyKeys = new Set([
  "courseSlug", "courseTitle", "amount", "currency", "date", "time", "firstName", "lastName", "name", "email", "participants", "addons", "coupon", "packageId", "serviceId", "phone", "photoContext", "flowContext", "kioskSessionToken", "kioskCurrentCourseDate", "kioskCurrentCourseTime", "kioskCurrentCourseDuration", "consecutivePriceCents", "consecutiveLinkedCourseSlug", "consecutiveCourseTitle", "consecutiveLinkedCourseTime",
])
const isBody = (value: unknown): value is CheckoutBody => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => bodyKeys.has(key)))

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch { return reject(400) }
  if (!isBody(body) || body.photoContext !== FLOW_CONTEXT.KIOSK_TERMINAL) return reject(400)

  try {
    const terminalAuth = await authorizeStaffTerminalSession({ touchLastSeen: false })
    if (!terminalAuth.ok) return reject(401)
    const kioskSession = await resolveTerminalKioskSession(body.kioskSessionToken, { terminalAuth, touch: false })
    if (!kioskSession.ok) return reject(kioskSession.status)
    const validation = await validateCheckoutPayload(body)
    if ("error" in validation) return reject(validation.status)
    const effective = resolveKioskEffectiveSessionDateTime({ photoContext: body.photoContext, validation })
    const terminalId = terminalAuth.terminal.id
    const userId = kioskSession.session.user.id
    if (!terminalId || !userId || !effective.date || !effective.time) return unresolved()
    const result = await getNativeAttemptState({
      userId,
      terminalId,
      kioskSessionId: kioskSession.session.id,
      selection: { courseSlug: validation.courseSlug, courseTitle: validation.courseTitle, amount: validation.amountInt, currency: validation.currency, packageId: validation.packageId, serviceId: validation.serviceId, addons: validation.addons, participants: validation.safeParticipants, coupon: validation.coupon, date: effective.date, time: effective.time, durationMinutes: validation.kioskCurrentCourseDuration },
    })
    return NextResponse.json(result, { headers })
  } catch {
    return unresolved()
  }
}
