import { NextResponse } from "next/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  resolveReportsSuggestionsWithProvider,
  type ReportsSuggestionPayload,
  type ReportsSuggestionsRequest,
} from "@/lib/staff/reports-suggestions-provider"
import { asObject } from "@/lib/shared"

export const runtime = "nodejs"

const parseObjectiveFilter = (value: unknown): ReportsSuggestionsRequest["objectiveFilter"] => {
  if (typeof value !== "string") return "all"
  const normalized = value.trim().toLowerCase()
  switch (normalized) {
    case "monday_sales":
    case "class_quality":
    case "retention":
    case "package_mix":
    case "pending_recovery":
      return normalized
    default:
      return "all"
  }
}

const parseRequestBody = (value: unknown): ReportsSuggestionsRequest => {
  const payload = asObject(value)
  return {
    objectiveFilter: parseObjectiveFilter(payload.objectiveFilter),
    metrics: asObject(payload.metrics),
    suggestions: (Array.isArray(payload.suggestions) ? payload.suggestions : []) as ReportsSuggestionPayload[],
  }
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:reports:suggestions:post", getClientIp(req)),
    limit: 40,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const request = parseRequestBody(body)
  const result = await resolveReportsSuggestionsWithProvider(request)

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    usedFallback: result.usedFallback,
    warning: result.warning,
    suggestions: result.suggestions,
  })
}

