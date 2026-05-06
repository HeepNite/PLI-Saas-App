import { Prisma } from "@prisma/client"
import {
  buildSessionEndsAtUtc,
  doUtcIntervalsOverlap,
  doUtcIntervalsOverlapWithBuffer,
} from "@/lib/class-schedule"
import { expandCourseScheduleSlots, type CourseScheduleLike, type ScheduleSlot } from "@/lib/course-schedule-blocks"
import type { StaffCategory, StaffSubCategory } from "@/lib/security/staff-category"
import type { StaffRole } from "@/lib/security/staff-role"

export type RoomScheduleSessionLike = {
  id: string
  roomId: string | null
  startsAt: Date
  durationMinutes: number | null
}

export type RoomReservationLike = {
  id: string
  roomId: string
  startsAt: Date
  endsAt: Date
  status: string
}

export type VirtualBlock = {
  startsAt: Date
  endsAt: Date
}

export type RoomAvailabilityInput = {
  roomId: string | null | undefined
  startsAt: Date
  endsAt: Date
  excludeSessionId?: string
  excludeReservationId?: string
  bufferMinutes?: number
  mode?: "symmetric" | "school-priority"
  virtualBlocks?: VirtualBlock[]
}

type AvailabilityConflict =
  | {
      kind: "class_session"
      id: string
      startsAt: Date
      endsAt: Date
    }
  | {
      kind: "reservation"
      id: string
      startsAt: Date
      endsAt: Date
    }
  | {
      kind: "schedule"
      startsAt: Date
      endsAt: Date
    }

const CANCELLED_STATUSES = new Set(["cancelled", "canceled"])

const isValidDate = (value: Date) => Number.isFinite(value.getTime())

const isCancelledReservation = (status: string) => CANCELLED_STATUSES.has(status.trim().toLowerCase())

const SCHOOL_TIMEZONE = "America/New_York"

export type AvailableRoom = {
  id: string
  name: string
}

export async function findAvailableRoomsForSlot(params: {
  targetStartsAt: Date
  targetEndsAt: Date
  excludeRoomId?: string
  bufferMinutes?: number
  prisma: {
    room: { findMany: (args: { where: { active: boolean } }) => Promise<Array<{ id: string; name: string; active: boolean }>> }
    classSession: {
      findMany: (args: {
        where: { roomId: { in: string[] }; startsAt: { gte: Date } }
      }) => Promise<Array<{ id: string; roomId: string | null; startsAt: Date; durationMinutes: number | null }>>
    }
    roomReservation: {
      findMany: (args: {
        where: { roomId: { in: string[] }; startsAt: { lt: Date }; endsAt: { gt: Date } }
      }) => Promise<Array<{ id: string; roomId: string; startsAt: Date; endsAt: Date; status: string }>>
    }
    courseCatalog: {
      findMany: (args: {
        where: { defaultRoomId: { in: string[] } }
      }) => Promise<Array<{
        id: string
        defaultRoomId: string | null
        durationMinutes: number | null
        scheduleRules: unknown
        availableWeekdays: number[]
        availableTimes: string[]
      }>>
    }
  }
}): Promise<AvailableRoom[]> {
  const { targetStartsAt, targetEndsAt, excludeRoomId, bufferMinutes = 0, prisma } = params
  const bufferMs = bufferMinutes * 60_000

  // Query all active rooms (exclude the conflicted room if provided)
  const allRooms = await prisma.room.findMany({ where: { active: true } })
  const candidateRooms = excludeRoomId ? allRooms.filter((r) => r.id !== excludeRoomId) : allRooms

  if (candidateRooms.length === 0) return []

  const roomIds = candidateRooms.map((r) => r.id)

  // Batch query sessions and reservations for all candidate rooms
  // Query a wide window: any session/reservation that could overlap with the target slot
  const paddedStart = new Date(targetStartsAt.getTime() - bufferMs - 24 * 60 * 60 * 1000)
  const paddedEnd = new Date(targetEndsAt.getTime() + bufferMs + 24 * 60 * 60 * 1000)

  const [sessions, reservations, courses] = await Promise.all([
    prisma.classSession.findMany({
      where: {
        roomId: { in: roomIds },
        startsAt: { gte: paddedStart },
      },
    }),
    prisma.roomReservation.findMany({
      where: {
        roomId: { in: roomIds },
        startsAt: { lt: paddedEnd },
        endsAt: { gt: paddedStart },
      },
    }),
    prisma.courseCatalog.findMany({
      where: { defaultRoomId: { in: roomIds } },
    }),
  ])

  // Build a map of roomId -> virtual blocks for courses with defaultRoomId
  // Expand the window by 24h on each side so we catch course slots that start
  // before but overlap with the target window.
  const expandStart = new Date(targetStartsAt.getTime() - 24 * 60 * 60 * 1000)
  const expandEnd = new Date(targetEndsAt.getTime() + 24 * 60 * 60 * 1000)

  const virtualBlocksByRoom = new Map<string, ScheduleSlot[]>()
  for (const course of courses) {
    if (!course.defaultRoomId) continue
    const courseLike: CourseScheduleLike = {
      scheduleRules: course.scheduleRules,
      availableWeekdays: course.availableWeekdays,
      availableTimes: course.availableTimes,
      defaultRoomId: course.defaultRoomId,
      durationMinutes: course.durationMinutes,
    }
    const slots = expandCourseScheduleSlots(courseLike, expandStart, expandEnd, SCHOOL_TIMEZONE)
    // Only keep slots that could overlap with the target window
    const relevantSlots = slots.filter(
      (s) => s.startsAt < targetEndsAt && s.endsAt > targetStartsAt
    )
    if (relevantSlots.length > 0) {
      const existing = virtualBlocksByRoom.get(course.defaultRoomId) ?? []
      virtualBlocksByRoom.set(course.defaultRoomId, [...existing, ...relevantSlots])
    }
  }

  // Check each room for conflicts
  const availableRooms: AvailableRoom[] = []
  for (const room of candidateRooms) {
    const roomSessions = sessions.filter((s) => s.roomId === room.id)
    const roomReservations = reservations.filter((r) => r.roomId === room.id)
    const roomVirtualBlocks = virtualBlocksByRoom.get(room.id) ?? []

    const conflict = findRoomAvailabilityConflict(roomSessions, roomReservations, {
      roomId: room.id,
      startsAt: targetStartsAt,
      endsAt: targetEndsAt,
      bufferMinutes,
      mode: "symmetric",
      virtualBlocks: roomVirtualBlocks.length > 0 ? roomVirtualBlocks : undefined,
    })

    if (!conflict) {
      availableRooms.push({ id: room.id, name: room.name })
    }
  }

  return availableRooms
}

export const findRoomAvailabilityConflict = (
  sessions: RoomScheduleSessionLike[],
  reservations: RoomReservationLike[],
  input: RoomAvailabilityInput
): AvailabilityConflict | null => {
  if (!input.roomId || !isValidDate(input.startsAt) || !isValidDate(input.endsAt)) return null
  if (input.endsAt.getTime() <= input.startsAt.getTime()) return null

  const bufferMs = (input.bufferMinutes ?? 0) * 60_000
  const mode = input.mode ?? "symmetric"

  const overlaps = bufferMs > 0
    ? (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
        doUtcIntervalsOverlapWithBuffer(aStart, aEnd, bStart, bEnd, bufferMs)
    : doUtcIntervalsOverlap

  // Check session conflicts
  for (const session of sessions) {
    if (session.roomId !== input.roomId) continue
    if (input.excludeSessionId && session.id === input.excludeSessionId) continue

    const sessionEndsAt = buildSessionEndsAtUtc(session.startsAt, session.durationMinutes)
    if (!sessionEndsAt) continue

    if (overlaps(input.startsAt, input.endsAt, session.startsAt, sessionEndsAt)) {
      return {
        kind: "class_session",
        id: session.id,
        startsAt: session.startsAt,
        endsAt: sessionEndsAt,
      }
    }
  }

  // Check virtual block conflicts (course schedule slots)
  if (input.virtualBlocks && input.virtualBlocks.length > 0) {
    for (const block of input.virtualBlocks) {
      if (!isValidDate(block.startsAt) || !isValidDate(block.endsAt)) continue

      if (overlaps(input.startsAt, input.endsAt, block.startsAt, block.endsAt)) {
        return {
          kind: "schedule",
          startsAt: block.startsAt,
          endsAt: block.endsAt,
        }
      }
    }
  }

  // Check reservation conflicts (skipped in school-priority mode)
  if (mode !== "school-priority") {
    for (const reservation of reservations) {
      if (reservation.roomId !== input.roomId) continue
      if (input.excludeReservationId && reservation.id === input.excludeReservationId) continue
      if (isCancelledReservation(reservation.status)) continue
      if (!isValidDate(reservation.startsAt) || !isValidDate(reservation.endsAt)) continue

      if (overlaps(input.startsAt, input.endsAt, reservation.startsAt, reservation.endsAt)) {
        return {
          kind: "reservation",
          id: reservation.id,
          startsAt: reservation.startsAt,
          endsAt: reservation.endsAt,
        }
      }
    }
  }

  return null
}

export type DisableRoomBlocker = {
  code: "SESSION_IN_NEXT_24H"
  sessionId: string
  startsAt: Date
  endsAt: Date
}

export const getDisableRoomBlockers = (
  sessions: RoomScheduleSessionLike[],
  now = new Date()
): DisableRoomBlocker[] => {
  const nowMs = now.getTime()
  const next24hMs = nowMs + 24 * 60 * 60 * 1000

  return sessions
    .map((session) => {
      const endsAt = buildSessionEndsAtUtc(session.startsAt, session.durationMinutes)
      if (!endsAt) return null

      const startsAtMs = session.startsAt.getTime()
      if (startsAtMs < nowMs || startsAtMs >= next24hMs) return null

      return {
        code: "SESSION_IN_NEXT_24H" as const,
        sessionId: session.id,
        startsAt: session.startsAt,
        endsAt,
      }
    })
    .filter((blocker): blocker is DisableRoomBlocker => blocker !== null)
}

export type SafeDeleteBlockerCode =
  | "FUTURE_SESSION"
  | "ACTIVE_OR_FUTURE_RESERVATION"
  | "DEFAULT_COURSE_REFERENCE"
  | "HISTORICAL_OPERATIONAL_LINK"

export type SafeDeleteBlocker = {
  code: SafeDeleteBlockerCode
  id?: string
  startsAt?: Date
  details?: string
}

export type SafeDeletePreconditionsInput = {
  now?: Date
  futureSessions: Array<{ id: string; startsAt: Date }>
  reservations: RoomReservationLike[]
  defaultCourses: Array<{ slug: string }>
  historical: {
    hasAttendanceLinks?: boolean
    hasPaymentLinks?: boolean
    hasAuditLinks?: boolean
  }
}

export const getSafeDeleteBlockers = (input: SafeDeletePreconditionsInput): SafeDeleteBlocker[] => {
  const now = input.now ?? new Date()
  const blockers: SafeDeleteBlocker[] = []

  for (const session of input.futureSessions) {
    if (session.startsAt.getTime() > now.getTime()) {
      blockers.push({ code: "FUTURE_SESSION", id: session.id, startsAt: session.startsAt })
    }
  }

  for (const reservation of input.reservations) {
    if (isCancelledReservation(reservation.status)) continue
    if (reservation.endsAt.getTime() <= now.getTime()) continue
    blockers.push({
      code: "ACTIVE_OR_FUTURE_RESERVATION",
      id: reservation.id,
      startsAt: reservation.startsAt,
    })
  }

  for (const course of input.defaultCourses) {
    blockers.push({ code: "DEFAULT_COURSE_REFERENCE", id: course.slug })
  }

  if (input.historical.hasAttendanceLinks || input.historical.hasPaymentLinks || input.historical.hasAuditLinks) {
    blockers.push({
      code: "HISTORICAL_OPERATIONAL_LINK",
      details: "Room has historical links (attendance, payment, or audit).",
    })
  }

  return blockers
}

export type ReassignmentPlanConflictCode = "TARGET_ROOM_CONFLICT"

export type ReassignmentPlanConflict = {
  code: ReassignmentPlanConflictCode
  sourceSessionId: string
  targetRoomId: string
  conflict: {
    kind: "class_session" | "reservation"
    id: string
    startsAt: Date
    endsAt: Date
  }
}

export type ReassignmentPlanResult =
  | {
      canCommit: true
      moves: Array<{ sessionId: string; fromRoomId: string; toRoomId: string }>
      blockers: []
    }
  | {
      canCommit: false
      moves: []
      blockers: ReassignmentPlanConflict[]
    }

export type ReassignmentPlanInput = {
  sourceRoomId: string
  targetRoomId: string
  now?: Date
  sessions: RoomScheduleSessionLike[]
  reservations: RoomReservationLike[]
}

export const planRoomReassignmentAllOrNothing = (input: ReassignmentPlanInput): ReassignmentPlanResult => {
  const now = input.now ?? new Date()
  const sourceFutureSessions = input.sessions.filter(
    (session) => session.roomId === input.sourceRoomId && session.startsAt.getTime() > now.getTime()
  )

  if (!sourceFutureSessions.length || input.sourceRoomId === input.targetRoomId) {
    return { canCommit: true, moves: [], blockers: [] }
  }

  const blockers: ReassignmentPlanConflict[] = []

  for (const sourceSession of sourceFutureSessions) {
    const sourceEndsAt = buildSessionEndsAtUtc(sourceSession.startsAt, sourceSession.durationMinutes)
    if (!sourceEndsAt) continue

    const conflict = findRoomAvailabilityConflict(input.sessions, input.reservations, {
      roomId: input.targetRoomId,
      startsAt: sourceSession.startsAt,
      endsAt: sourceEndsAt,
      excludeSessionId: sourceSession.id,
    })

    if (conflict) {
      blockers.push({
        code: "TARGET_ROOM_CONFLICT",
        sourceSessionId: sourceSession.id,
        targetRoomId: input.targetRoomId,
        conflict,
      })
    }
  }

  if (blockers.length > 0) {
    return { canCommit: false, moves: [], blockers }
  }

  return {
    canCommit: true,
    moves: sourceFutureSessions.map((session) => ({
      sessionId: session.id,
      fromRoomId: input.sourceRoomId,
      toRoomId: input.targetRoomId,
    })),
    blockers: [],
  }
}

export type ReservationLifecycleStatus = "active" | "cancelled"
export type ReservationLifecycleAction = "create" | "update" | "cancel"

export type ReservationLifecycleDecision = {
  allowed: boolean
  status: ReservationLifecycleStatus
  reasonCode?:
    | "ROOM_DISABLED"
    | "INVALID_INTERVAL"
    | "ALREADY_CANCELLED"
    | "CONFLICT"
}

const normalizeReservationLifecycleStatus = (status: string | null | undefined): ReservationLifecycleStatus =>
  isCancelledReservation(status ?? "") ? "cancelled" : "active"

export const decideReservationLifecycleAction = (input: {
  action: ReservationLifecycleAction
  currentStatus?: string | null
  roomIsActive: boolean
  startsAt?: Date
  endsAt?: Date
  sessions?: RoomScheduleSessionLike[]
  reservations?: RoomReservationLike[]
  roomId?: string | null
  excludeReservationId?: string
  bufferMinutes?: number
  mode?: "symmetric" | "school-priority"
  virtualBlocks?: VirtualBlock[]
}): ReservationLifecycleDecision => {
  const current = normalizeReservationLifecycleStatus(input.currentStatus)

  if (input.action === "cancel") {
    if (current === "cancelled") return { allowed: false, status: "cancelled", reasonCode: "ALREADY_CANCELLED" }
    return { allowed: true, status: "cancelled" }
  }

  if (!input.roomIsActive) return { allowed: false, status: current, reasonCode: "ROOM_DISABLED" }
  if (!input.startsAt || !input.endsAt || input.endsAt.getTime() <= input.startsAt.getTime()) {
    return { allowed: false, status: current, reasonCode: "INVALID_INTERVAL" }
  }

  const conflict = findRoomAvailabilityConflict(input.sessions ?? [], input.reservations ?? [], {
    roomId: input.roomId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    excludeReservationId: input.excludeReservationId,
    bufferMinutes: input.bufferMinutes,
    mode: input.mode,
    virtualBlocks: input.virtualBlocks,
  })

  if (conflict) return { allowed: false, status: current, reasonCode: "CONFLICT" }
  return { allowed: true, status: "active" }
}

type RoomLifecycleActor = {
  role: StaffRole | null | undefined
  category?: StaffCategory | null | undefined
  subCategory?: StaffSubCategory | null | undefined
}

const isOwnerOrAdmin = (actor: RoomLifecycleActor) => actor.role === "owner" || actor.role === "admin"

const isManager = (actor: RoomLifecycleActor) =>
  actor.category === "manager" || (actor.category === "guest" && actor.subCategory === "manager")

const isFrontDesk = (actor: RoomLifecycleActor) =>
  actor.category === "front_desk" || (actor.category === "guest" && actor.subCategory === "front_desk")

const isProfessor = (actor: RoomLifecycleActor) =>
  actor.category === "teacher" || (actor.category === "guest" && actor.subCategory === "teacher")

export const canDisableOrReassignRoom = (actor: RoomLifecycleActor) =>
  isOwnerOrAdmin(actor) || isManager(actor)

export const canHardDeleteRoom = (actor: RoomLifecycleActor) => isOwnerOrAdmin(actor)

export const canHardDeleteReservation = (actor: RoomLifecycleActor) => isOwnerOrAdmin(actor)

export const canViewReservationByScope = (input: {
  actor: RoomLifecycleActor
  actorClerkUserId: string
  assignedStaffClerkUserId?: string | null
}): boolean => {
  if (isOwnerOrAdmin(input.actor) || isManager(input.actor) || isFrontDesk(input.actor)) return true
  if (!isProfessor(input.actor)) return false
  return Boolean(input.assignedStaffClerkUserId && input.assignedStaffClerkUserId === input.actorClerkUserId)
}

export const canHardDeletePrivateReservation = (input: {
  actor: RoomLifecycleActor
  hasPaymentLinks?: boolean
  hasCheckInLinks?: boolean
  hasAttendanceLinks?: boolean
  hasHistoricalOperationalLinks?: boolean
}) => {
  if (!canHardDeleteReservation(input.actor)) {
    return { allowed: false as const, reasonCode: "FORBIDDEN" as const }
  }

  if (
    input.hasPaymentLinks ||
    input.hasCheckInLinks ||
    input.hasAttendanceLinks ||
    input.hasHistoricalOperationalLinks
  ) {
    return { allowed: false as const, reasonCode: "HAS_OPERATIONAL_LINKS" as const }
  }

  return { allowed: true as const }
}

export type RoomLifecycleAuditAction =
  | "room_disable"
  | "room_safe_delete"
  | "room_reassignment"
  | "reservation_cancel"
  | "reservation_safe_delete"

export const buildRoomLifecycleAuditPayload = (input: {
  action: RoomLifecycleAuditAction
  actorClerkUserId: string
  actorRole: string
  outcome: "success" | "denied" | "failed"
  roomId?: string | null
  roomNameSnapshot: string
  reason?: string | null
  blockers?: unknown
  metadata?: Record<string, unknown>
}): Prisma.RoomAuditLogUncheckedCreateInput => ({
  roomId: input.roomId ?? null,
  roomNameSnapshot: input.roomNameSnapshot,
  action: input.action,
  actorClerkUserId: input.actorClerkUserId,
  actorRole: input.actorRole,
  reason: input.reason ?? null,
  outcome: input.outcome,
  blockers: (input.blockers ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
  metadata: (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
})
