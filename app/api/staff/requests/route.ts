import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { canAccessStaffPortalSection } from "@/lib/security/staff-access"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  parseStaffRequestStatus,
  parseStaffRequestType,
  STAFF_REQUEST_TYPES,
  type StaffRequestStatus,
} from "@/lib/security/staff-request"
import { asObject } from "@/lib/shared"

export const runtime = "nodejs"

const STAFF_REQUEST_STATUS_DEFAULT: StaffRequestStatus = "PENDING"

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:requests:get", getClientIp(req)),
    limit: 90,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  if (!authResult.role) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  const url = new URL(req.url)
  const statusFilter = parseStaffRequestStatus(url.searchParams.get("status"))
  const typeFilter = parseStaffRequestType(url.searchParams.get("type"))
  const query = url.searchParams.get("q")?.trim() || ""
  const scope = url.searchParams.get("scope") === "mine" ? "mine" : "all"
  const canReviewAllRequests = canAccessStaffPortalSection(authResult.role, authResult.category, "users")
  const ownOnly = scope === "mine" || !canReviewAllRequests

  const requests = await prisma.actionRequest.findMany({
    where: {
      ...(ownOnly ? { userId: authResult.userId } : {}),
      type: typeFilter || { in: [...STAFF_REQUEST_TYPES] },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(query
        ? {
            OR: [
              { message: { contains: query, mode: "insensitive" } },
              { user: { email: { contains: query, mode: "insensitive" } } },
              { user: { name: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 120,
  })

  const items = requests.map((request) => ({
    id: request.id,
    type: request.type,
    status: request.status,
    message: request.message || "",
    meta: asObject(request.meta),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    resolvedAt: request.resolvedAt?.toISOString() || null,
    user: {
      id: request.user.id,
      name: request.user.name || "Staff",
      email: request.user.email,
      phone: request.user.phone || "",
    },
  }))

  const summary = {
    total: items.length,
    pending: items.filter((item) => item.status === "PENDING").length,
    inReview: items.filter((item) => item.status === "IN_REVIEW").length,
    approved: items.filter((item) => item.status === "APPROVED").length,
    rejected: items.filter((item) => item.status === "REJECTED").length,
  }

  return NextResponse.json({ items, summary })
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:requests:post", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  if (!authResult.role) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const type = parseStaffRequestType(payload.type)
  if (!type) {
    return NextResponse.json({ error: "Invalid request type" }, { status: 400 })
  }

  const message = typeof payload.message === "string" ? payload.message.trim().slice(0, 500) : ""
  const meta = asObject(payload.meta)
  const status = parseStaffRequestStatus(payload.status) || STAFF_REQUEST_STATUS_DEFAULT

  const created = await prisma.actionRequest.create({
    data: {
      userId: authResult.userId,
      type,
      status,
      message,
      meta: meta as Prisma.InputJsonObject,
    },
  })

  return NextResponse.json({
    ok: true,
    request: {
      id: created.id,
      status: created.status,
      type: created.type,
    },
  })
}
