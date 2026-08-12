import { NextResponse } from "next/server"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import type { StaffPortalAuthResult } from "@/lib/security/staff-portal-auth"

type RateLimitOptions = {
  scope: string
  limit: number
  windowMs: number
}

type AnyAuthResult =
  | { ok: true; [key: string]: unknown }
  | { ok: false; status: number; error: string; [key: string]: unknown }

type GuardOptions<TAuth extends AnyAuthResult> = {
  rateLimit: RateLimitOptions
  authorize: () => Promise<TAuth>
}

type GuardSuccess<TAuth extends AnyAuthResult> = {
  ok: true
  auth: Extract<TAuth, { ok: true }>
}

type GuardFailure = {
  ok: false
  response: NextResponse
}

export type StaffGuardResult = GuardSuccess<StaffPortalAuthResult> | GuardFailure

export async function withStaffGuard<TAuth extends AnyAuthResult>(
  req: Request,
  options: GuardOptions<TAuth>
): Promise<GuardSuccess<TAuth> | GuardFailure> {
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

  return { ok: true, auth: authResult as Extract<TAuth, { ok: true }> }
}
