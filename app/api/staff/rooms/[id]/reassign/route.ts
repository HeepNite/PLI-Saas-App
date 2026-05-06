import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  buildRoomLifecycleAuditPayload,
  canDisableOrReassignRoom,
  planRoomReassignmentAllOrNothing,
} from "@/lib/room-availability"
import { toRoomId } from "../../shared"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:rooms:reassign:post", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })

  const auth = await authorizeStaffPortalRequest()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!canDisableOrReassignRoom({ role: auth.role, category: auth.category })) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  const { id } = await context.params
  const sourceRoomId = toRoomId(id)
  if (!sourceRoomId) return NextResponse.json({ error: "Invalid room id." }, { status: 400 })

  const payload = (await req.json().catch(() => ({}))) as {
    targetRoomId?: unknown
    moveFutureSessions?: unknown
    courseIds?: unknown
  }
  const targetRoomId = toRoomId(payload.targetRoomId)
  const moveFutureSessions = payload.moveFutureSessions === true
  const rawCourseIds = payload.courseIds
  if (typeof rawCourseIds !== "undefined" && !Array.isArray(rawCourseIds)) {
    return NextResponse.json({ error: "courseIds must be an array of course ids." }, { status: 400 })
  }
  if (Array.isArray(rawCourseIds) && rawCourseIds.some((item) => typeof item !== "string" || !item.trim())) {
    return NextResponse.json({ error: "courseIds must contain valid non-empty strings." }, { status: 400 })
  }
  if (!targetRoomId) return NextResponse.json({ error: "Valid targetRoomId is required." }, { status: 400 })

  const selectedCourseIds = Array.isArray(rawCourseIds)
    ? [...new Set(rawCourseIds.map((item) => item.trim()).filter(Boolean))]
    : []
  const selectiveMode = selectedCourseIds.length > 0

  const [sourceRoom, targetRoom] = await Promise.all([
    prisma.room.findUnique({ where: { id: sourceRoomId }, select: { id: true, name: true } }),
    prisma.room.findUnique({ where: { id: targetRoomId }, select: { id: true, name: true, active: true } }),
  ])
  if (!sourceRoom) return NextResponse.json({ error: "Source room not found." }, { status: 404 })
  if (!targetRoom || !targetRoom.active) return NextResponse.json({ error: "Target room not found or inactive." }, { status: 404 })

  const selectedCourses = selectiveMode
    ? await prisma.courseCatalog.findMany({
        where: {
          defaultRoomId: sourceRoomId,
          id: { in: selectedCourseIds },
        },
        select: {
          id: true,
          slug: true,
          title: true,
        },
      })
    : []

  if (selectiveMode && selectedCourses.length !== selectedCourseIds.length) {
    const selectedById = new Set(selectedCourses.map((course) => course.id))
    const invalidCourseIds = selectedCourseIds.filter((courseId) => !selectedById.has(courseId))
    return NextResponse.json(
      {
        error: "Some selected courses are not assigned to the source room.",
        blockers: invalidCourseIds.map((courseId) => ({
          code: "INVALID_COURSE_SELECTION",
          id: courseId,
          details: "Course is not assigned to the source room.",
        })),
      },
      { status: 409 }
    )
  }

  const selectedCourseSlugs = selectiveMode ? new Set(selectedCourses.map((course) => course.slug)) : null

  const now = new Date()
  const [sessions, reservations] = await Promise.all([
    prisma.classSession.findMany({
      where: { OR: [{ roomId: sourceRoomId }, { roomId: targetRoomId }], startsAt: { gt: now } },
      select: { id: true, roomId: true, courseSlug: true, startsAt: true, durationMinutes: true },
      take: 500,
    }),
    prisma.roomReservation.findMany({
      where: { roomId: targetRoomId },
      select: { id: true, roomId: true, startsAt: true, endsAt: true, status: true },
      take: 500,
    }),
  ])

  const plannedSessions =
    selectiveMode && selectedCourseSlugs
      ? sessions.filter((session) => session.roomId !== sourceRoomId || selectedCourseSlugs.has(session.courseSlug))
      : sessions

  const plan = moveFutureSessions
    ? planRoomReassignmentAllOrNothing({ sourceRoomId, targetRoomId, now, sessions: plannedSessions, reservations })
    : { canCommit: true as const, blockers: [], moves: [] }

  if (!plan.canCommit) {
    await prisma.roomAuditLog.create({
      data: buildRoomLifecycleAuditPayload({
        action: "room_reassignment",
        actorClerkUserId: auth.userId,
        actorRole: auth.role,
        outcome: "denied",
        roomId: sourceRoom.id,
        roomNameSnapshot: sourceRoom.name,
        blockers: plan.blockers,
        metadata: { sourceRoomId, targetRoomId, moveFutureSessions },
      }),
    })
    return NextResponse.json({ error: "Target room has conflicts.", blockers: plan.blockers }, { status: 409 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const reassignedDefaults = await tx.courseCatalog.updateMany({
      where: selectiveMode
        ? {
            defaultRoomId: sourceRoomId,
            id: { in: selectedCourseIds },
          }
        : { defaultRoomId: sourceRoomId },
      data: { defaultRoomId: targetRoomId },
    })

    let movedSessions = 0
    if (moveFutureSessions && plan.moves.length > 0) {
      const moveIds = plan.moves.map((move) => move.sessionId)
      const moved = await tx.classSession.updateMany({ where: { id: { in: moveIds } }, data: { roomId: targetRoomId } })
      movedSessions = moved.count
    }

    const audit = await tx.roomAuditLog.create({
      data: buildRoomLifecycleAuditPayload({
        action: "room_reassignment",
        actorClerkUserId: auth.userId,
        actorRole: auth.role,
        outcome: "success",
        roomId: sourceRoom.id,
        roomNameSnapshot: sourceRoom.name,
        metadata: { sourceRoomId, targetRoomId, moveFutureSessions, movedSessions, reassignedDefaults: reassignedDefaults.count },
      }),
      select: { id: true },
    })

    return { movedSessions, reassignedDefaults: reassignedDefaults.count, auditId: audit.id }
  })

  return NextResponse.json({ ok: true, ...result })
}
