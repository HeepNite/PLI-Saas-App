import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const REQUEST_TYPES = new Set(["CLASS_CHANGE", "SUSPEND", "CANCEL"])
const PENDING_STATUSES = ["PENDING", "PROCESSING"]

const sanitizeMessage = (value: unknown) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  return trimmed.slice(0, 500)
}

const sanitizeId = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, 80)
}

const sanitizeIsoDate = (value: unknown) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return ""
  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return ""
  return trimmed
}

export async function GET(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:requests:get", getClientIp(req)),
      limit: 90,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phone = clerkUser.primaryPhoneNumber?.phoneNumber || ""
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

    const dbUser = await upsertUserByIdentifiers({
      clerkId: authResult.userId,
      email,
      name,
      phone,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    const requests = await prisma.actionRequest.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return NextResponse.json({
      requests: requests.map((request) => ({
        id: request.id,
        type: request.type,
        status: request.status,
        message: request.message,
        meta: request.meta,
        createdAt: request.createdAt.toISOString(),
        resolvedAt: request.resolvedAt ? request.resolvedAt.toISOString() : null,
      })),
    })
  } catch (error) {
    console.error("Profile requests GET failed", error)
    return NextResponse.json({ error: "Unable to load requests" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:requests:post", getClientIp(req)),
      limit: 20,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let payload: unknown
    try {
      payload = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null
    const type = typeof body?.type === "string" ? body.type.trim().toUpperCase() : ""
    const message = sanitizeMessage(body?.message)
    const metaInput = body?.meta && typeof body.meta === "object" ? (body.meta as Record<string, unknown>) : null

    if (!REQUEST_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid request type" }, { status: 400 })
    }
    if (type === "CLASS_CHANGE" && message.length < 6) {
      return NextResponse.json({ error: "Please include a reason for class change" }, { status: 400 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phone = clerkUser.primaryPhoneNumber?.phoneNumber || ""
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

    const dbUser = await upsertUserByIdentifiers({
      clerkId: authResult.userId,
      email,
      name,
      phone,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    let requestMeta: Record<string, unknown> | null = null
    if (type === "SUSPEND") {
      const startDate = sanitizeIsoDate(metaInput?.startDate)
      const endDate = sanitizeIsoDate(metaInput?.endDate)
      const packagePurchaseId = sanitizeId(metaInput?.packagePurchaseId)
      if (!startDate || !endDate) {
        return NextResponse.json({ error: "Suspend requests require start and end dates" }, { status: 400 })
      }
      if (!packagePurchaseId) {
        return NextResponse.json({ error: "Suspend requests require a package selection" }, { status: 400 })
      }
      if (new Date(`${endDate}T00:00:00.000Z`) < new Date(`${startDate}T00:00:00.000Z`)) {
        return NextResponse.json({ error: "Suspend end date must be the same or after start date" }, { status: 400 })
      }
      const targetPackage = await prisma.packagePurchase.findFirst({
        where: {
          id: packagePurchaseId,
          userId: dbUser.id,
          status: "active",
        },
        select: {
          id: true,
          packageId: true,
          packageLabel: true,
          courseSlug: true,
          expiresAt: true,
        },
      })
      if (!targetPackage) {
        return NextResponse.json({ error: "Selected package was not found for this user" }, { status: 404 })
      }
      requestMeta = {
        startDate,
        endDate,
        packagePurchaseId: targetPackage.id,
        packageLabel: targetPackage.packageLabel || targetPackage.packageId,
        courseSlug: targetPackage.courseSlug,
        packageExpiresAt: targetPackage.expiresAt ? targetPackage.expiresAt.toISOString() : null,
      }
    }
    if (type === "CANCEL") {
      const effectiveDate = sanitizeIsoDate(metaInput?.effectiveDate)
      const attendanceId = sanitizeId(metaInput?.attendanceId)
      const refundRequested = metaInput?.refundRequested === true
      if (!effectiveDate) {
        return NextResponse.json({ error: "Cancel requests require an effective date" }, { status: 400 })
      }
      if (!attendanceId) {
        return NextResponse.json({ error: "Cancel requests require a class selection" }, { status: 400 })
      }
      if (!refundRequested) {
        return NextResponse.json({ error: "Cancel requests must include refund confirmation" }, { status: 400 })
      }
      const attendance = await prisma.attendance.findFirst({
        where: {
          id: attendanceId,
          userId: dbUser.id,
          status: { in: ["scheduled", "checked_in", "checked_in_no_package"] },
        },
        include: {
          session: {
            select: {
              id: true,
              courseSlug: true,
              startsAt: true,
              title: true,
            },
          },
        },
      })
      if (!attendance) {
        return NextResponse.json({ error: "Selected class was not found for this user" }, { status: 404 })
      }
      requestMeta = {
        effectiveDate,
        attendanceId: attendance.id,
        sessionId: attendance.sessionId,
        courseSlug: attendance.session.courseSlug,
        courseTitle: attendance.session.title || attendance.session.courseSlug,
        startsAt: attendance.session.startsAt.toISOString(),
        refundRequested: true,
      }
    }

    const pendingWhere: Prisma.ActionRequestWhereInput = {
      userId: dbUser.id,
      type,
      status: { in: PENDING_STATUSES },
    }
    if (type === "SUSPEND" && requestMeta?.packagePurchaseId) {
      pendingWhere.meta = {
        path: ["packagePurchaseId"],
        equals: requestMeta.packagePurchaseId,
      }
    }
    if (type === "CANCEL" && requestMeta?.attendanceId) {
      pendingWhere.meta = {
        path: ["attendanceId"],
        equals: requestMeta.attendanceId,
      }
    }

    const pending = await prisma.actionRequest.findFirst({
      where: pendingWhere,
      orderBy: { createdAt: "desc" },
    })

    if (pending) {
      return NextResponse.json(
        { error: "You already have a pending request of this type." },
        { status: 409 }
      )
    }

    const created = await prisma.actionRequest.create({
      data: {
        userId: dbUser.id,
        type,
        status: "PENDING",
        message: message || null,
        meta: requestMeta,
      },
    })

    return NextResponse.json({
      request: {
        id: created.id,
        type: created.type,
        status: created.status,
        message: created.message,
        meta: created.meta,
        createdAt: created.createdAt.toISOString(),
        resolvedAt: null,
      },
    })
  } catch (error) {
    console.error("Profile requests POST failed", error)
    return NextResponse.json({ error: "Unable to create request" }, { status: 500 })
  }
}
