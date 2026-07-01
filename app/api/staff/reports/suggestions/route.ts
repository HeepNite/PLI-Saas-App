import { NextResponse } from "next/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
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
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:reports:suggestions:post", limit: 40, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response

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

