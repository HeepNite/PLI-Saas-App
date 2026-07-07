import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { resolveStaffUserByPin } from "@/lib/security/staff-pin-auth"
import { resolveStaffPinGate } from "@/lib/security/staff-pin-gate"
import {
  clearPinAttemptWindow,
  computeTerminalTargetedCap,
  isAnyPinTargetBlocked,
  recordPinAttemptMiss,
} from "@/lib/security/staff-pin-throttle"
import { enrollTrustedDevice, setTrustedDeviceCookie } from "@/lib/security/staff-trusted-device"
import { listStaffRosterForSchool } from "@/lib/security/staff-roster"

export const runtime = "nodejs"

const isTerminalAggregateKey = (key: string) => key.startsWith("terminal:")

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:login:pin:post", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const pin = typeof payload.pin === "string" ? payload.pin.trim() : ""
  const requestedUserId = typeof payload.userId === "string" ? payload.userId.trim() : ""

  // TOTAL gate (design v5): resolve a server-derived trusted context BEFORE
  // any PIN evaluation. No context -> 403 in every gate mode. `payload.schoolId`
  // is never read — expectedSchoolId always comes from the resolved context.
  const gate = await resolveStaffPinGate()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }
  const { context } = gate

  // login/pin NEVER scans a roster — it always resolves exactly one target.
  // No blind scan-all -> signInToken mint, in ANY gate mode.
  if (!requestedUserId) {
    return NextResponse.json({ error: "Select a staff member to sign in." }, { status: 400 })
  }

  let restrictToUserId: string
  let expectedSchoolId: string
  const throttleKeys: string[] = []
  let terminalAggregateKey: string | null = null
  let terminalAggregateCap = 0

  if (context.kind === "TERMINAL") {
    restrictToUserId = requestedUserId
    expectedSchoolId = context.expectedSchoolId
    terminalAggregateKey = `terminal:${context.terminalSlug}:targeted`
    // Real roster size (design ADR 15) — replaces the PR2 fixed
    // TERMINAL_TARGETED_BASE_CAP constant with min(20, ceil(0.5*roster)).
    const roster = await listStaffRosterForSchool(expectedSchoolId)
    terminalAggregateCap = computeTerminalTargetedCap(roster.length)
    throttleKeys.push(`user:${restrictToUserId}`, terminalAggregateKey)
  } else {
    // PERSONAL / CLERK_SESSION: self-restricted to the owning identity.
    if (requestedUserId !== context.ownerUserId) {
      return NextResponse.json(
        { error: "You may only sign in as yourself from this device." },
        { status: 403 }
      )
    }
    restrictToUserId = context.ownerUserId
    expectedSchoolId = context.expectedSchoolId
    throttleKeys.push(`user:${restrictToUserId}`)
  }

  const throttleStatus = await isAnyPinTargetBlocked(throttleKeys)
  if (throttleStatus.blocked) {
    return NextResponse.json(
      { error: throttleStatus.reason || "Too many failed attempts. Please try again later." },
      {
        status: 423,
        headers: throttleStatus.retryAfterSec ? { "Retry-After": String(throttleStatus.retryAfterSec) } : undefined,
      }
    )
  }

  const resolved = await resolveStaffUserByPin({ pin, restrictToUserId, expectedSchoolId })
  if (!resolved.ok) {
    if (resolved.status === 403 && terminalAggregateKey) {
      // Pre-attempt school-scope rejection — increments the terminal aggregate
      // only (not the victim key: the requester never proved they know a PIN
      // for this school at all).
      await recordPinAttemptMiss({
        targetKey: terminalAggregateKey,
        kind: "terminal",
        effectiveCap: terminalAggregateCap,
      })
    } else if (resolved.status === 401) {
      await Promise.all(
        throttleKeys.map((key) =>
          recordPinAttemptMiss({
            targetKey: key,
            kind: isTerminalAggregateKey(key) ? "terminal" : "user",
            effectiveCap: isTerminalAggregateKey(key) ? terminalAggregateCap : undefined,
          })
        )
      )
    }
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  await Promise.all(throttleKeys.map((key) => clearPinAttemptWindow(key)))

  const { user: matchedUser, role: matchedRole, category } = resolved.staff

  console.info("staff/login/pin authenticated user", {
    userId: matchedUser.id,
    role: matchedRole,
    category,
    context: context.kind,
    schoolContext: expectedSchoolId,
  })

  const client = await clerkClient()

  const signInToken = await client.signInTokens.createSignInToken({
    userId: matchedUser.id,
    expiresInSeconds: 300,
  })

  const requestUrl = new URL(req.url)
  const redirectTo = `${requestUrl.origin}/staff/resolve`
  const signInUrl = new URL(signInToken.url)
  signInUrl.searchParams.set("redirect_url", redirectTo)
  const ticketFromUrl = signInUrl.searchParams.get("token")
  const ticket =
    typeof (signInToken as { token?: unknown }).token === "string"
      ? ((signInToken as { token: string }).token || "").trim()
      : (ticketFromUrl || "").trim()

  const name =
    `${matchedUser.firstName || ""} ${matchedUser.lastName || ""}`.trim() ||
    matchedUser.primaryEmailAddress?.emailAddress ||
    matchedUser.id

  const response = NextResponse.json({
    ok: true,
    signInUrl: signInUrl.toString(),
    ticket,
    staff: {
      id: matchedUser.id,
      name,
      role: matchedRole,
      category,
    },
  })

  // GRANDFATHER auto-enroll (design v5 ADR 1/13): scoped to the CLERK_SESSION
  // context ONLY. A hit reached under a TERMINAL or PERSONAL context NEVER
  // auto-enrolls — this prevents a stray signed-in session on a SHARED
  // terminal from converting a multi-staff kiosk into a single-user trusted
  // device or a no-SMS PIN entry point.
  if (context.kind === "CLERK_SESSION") {
    const { token } = await enrollTrustedDevice(matchedUser.id)
    setTrustedDeviceCookie(response, token)
    console.warn("staff/login/pin GRANDFATHER auto-enroll", { staffUserId: matchedUser.id })
  }

  return response
}
