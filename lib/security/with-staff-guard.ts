import { NextResponse } from "next/server"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import type { StaffPortalAuthResult } from "@/lib/security/staff-portal-auth"

type RateLimitOptions = {
  scope: string
  limit: number
  windowMs: number
}

type GuardOptions = {
  rateLimit: RateLimitOptions
  authorize: () => Promise<StaffPortalAuthResult>
}

type GuardSuccess = {
  ok: true
  auth: Extract<StaffPortalAuthResult, { ok: true }>
}

type GuardFailure = {
  ok: false
  response: NextResponse
}

export type StaffGuardResult = GuardSuccess | GuardFailure

export async function withStaffGuard(req: Request, options: GuardOptions): Promise<StaffGuardResult> {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey(options.rateLimit.scope, getClientIp(req)),
    limit: options.rateLimit.limit,
    windowMs: options.rateLimit.windowMs,
  })
  if (!rateLimit.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      ),
    }
  }

  const authResult = await options.authorize()
  if (!authResult.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: authResult.error }, { status: authResult.status }),
    }
  }

  return { ok: true, auth: authResult }
}
