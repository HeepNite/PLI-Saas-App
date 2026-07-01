import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { asObject } from "@/lib/shared"

export const runtime = "nodejs"

type PerformancePayload = {
  reviewCycleDays?: number
  teacherType?: string
  assignedTeacherUserId?: string
  recurrenceUnit?: "month" | "year"
  recurrenceInterval?: number
  courseSlugs?: string[]
  weekdays?: number[]
  shiftStart?: string
  shiftEnd?: string
  weeklyHours?: number
  bonusTargetHours?: number
}

const TEACHER_TYPES = ["lead", "assistant", "substitute", "kids_program", "specialist", "open_format"] as const

const normalizeWeekdays = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  const days = value
    .map((day) => (typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6 ? day : null))
    .filter((day): day is number => day !== null)
  return Array.from(new Set(days)).sort((a, b) => a - b)
}

const normalizeTime = (value: unknown): string => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed) ? trimmed : ""
}

const normalizeTeacherType = (value: unknown): string => {
  if (typeof value !== "string") return ""
  const normalized = value.trim().toLowerCase()
  return TEACHER_TYPES.includes(normalized as (typeof TEACHER_TYPES)[number]) ? normalized : ""
}

const normalizeRecurrenceUnit = (value: unknown): "month" | "year" | "" => {
  if (value === "month" || value === "year") return value
  return ""
}

const normalizeRecurrenceInterval = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  if (rounded < 1 || rounded > 12) return null
  return rounded
}

const normalizeCourseSlugs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    )
  ).slice(0, 10)
}

const normalizeNumber = (value: unknown, { min = 0, max = 999 }: { min?: number; max?: number }) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (value < min || value > max) return null
  return Math.round(value * 100) / 100
}

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:users:performance:patch", limit: 120, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as PerformancePayload
  if (typeof (payload as Record<string, unknown>).rating !== "undefined") {
    return NextResponse.json(
      { error: "Rating is audit-managed and cannot be edited from admin controls." },
      { status: 403 }
    )
  }

  const client = await clerkClient()
  const current = await client.users.getUser(userId)
  const targetRole = extractStaffRoleFromUserMetadata(current)
  if (authResult.role !== "owner" && targetRole === "owner") {
    return NextResponse.json({ error: "Admins cannot update Owner performance settings." }, { status: 403 })
  }

  const reviewCycleDays = normalizeNumber(payload.reviewCycleDays, { min: 7, max: 90 })
  if (typeof payload.reviewCycleDays !== "undefined" && reviewCycleDays === null) {
    return NextResponse.json({ error: "Review cycle days must be between 7 and 90." }, { status: 400 })
  }

  const weeklyHours = normalizeNumber(payload.weeklyHours, { min: 0, max: 80 })
  if (typeof payload.weeklyHours !== "undefined" && weeklyHours === null) {
    return NextResponse.json({ error: "Weekly hours must be between 0 and 80." }, { status: 400 })
  }

  const bonusTargetHours = normalizeNumber(payload.bonusTargetHours, { min: 0, max: 300 })
  if (typeof payload.bonusTargetHours !== "undefined" && bonusTargetHours === null) {
    return NextResponse.json({ error: "Bonus target hours must be between 0 and 300." }, { status: 400 })
  }

  const teacherType = normalizeTeacherType(payload.teacherType)
  if (typeof payload.teacherType !== "undefined" && !teacherType) {
    return NextResponse.json({ error: "Invalid teacher type." }, { status: 400 })
  }

  const assignedTeacherUserId =
    typeof payload.assignedTeacherUserId === "string" ? payload.assignedTeacherUserId.trim() : ""
  if (typeof payload.assignedTeacherUserId !== "undefined" && !assignedTeacherUserId) {
    return NextResponse.json({ error: "Assigned teacher is required." }, { status: 400 })
  }
  if (assignedTeacherUserId) {
    const assignedTeacher = await client.users.getUser(assignedTeacherUserId).catch(() => null)
    if (!assignedTeacher) {
      return NextResponse.json({ error: "Assigned teacher not found." }, { status: 400 })
    }
    const assignedRole = extractStaffRoleFromUserMetadata(assignedTeacher)
    if (!assignedRole) {
      return NextResponse.json({ error: "Assigned teacher must be a staff user." }, { status: 400 })
    }
  }

  const recurrenceUnit = normalizeRecurrenceUnit(payload.recurrenceUnit)
  if (typeof payload.recurrenceUnit !== "undefined" && !recurrenceUnit) {
    return NextResponse.json({ error: "Recurrence unit must be month or year." }, { status: 400 })
  }
  const recurrenceInterval = normalizeRecurrenceInterval(payload.recurrenceInterval)
  if (typeof payload.recurrenceInterval !== "undefined" && recurrenceInterval === null) {
    return NextResponse.json({ error: "Recurrence interval must be between 1 and 12." }, { status: 400 })
  }
  const courseSlugs = normalizeCourseSlugs(payload.courseSlugs)
  if (typeof payload.courseSlugs !== "undefined" && courseSlugs.length === 0) {
    return NextResponse.json({ error: "Select at least one course for the program." }, { status: 400 })
  }

  const shiftStart = normalizeTime(payload.shiftStart)
  const shiftEnd = normalizeTime(payload.shiftEnd)
  if (typeof payload.shiftStart !== "undefined" && !shiftStart) {
    return NextResponse.json({ error: "Invalid shift start time. Use HH:mm." }, { status: 400 })
  }
  if (typeof payload.shiftEnd !== "undefined" && !shiftEnd) {
    return NextResponse.json({ error: "Invalid shift end time. Use HH:mm." }, { status: 400 })
  }

  const weekdays = normalizeWeekdays(payload.weekdays)
  if (typeof payload.weekdays !== "undefined" && weekdays.length === 0) {
    return NextResponse.json({ error: "Select at least one weekday." }, { status: 400 })
  }

  const publicMetadata = asObject(current.publicMetadata)
  const currentPerformance = asObject(publicMetadata.staffPerformance)
  const currentTeaching = asObject(publicMetadata.staffTeaching)

  const nextPerformance: Record<string, unknown> = {
    ...currentPerformance,
    updatedAt: new Date().toISOString(),
  }
  if (typeof reviewCycleDays === "number") {
    nextPerformance.reviewCycleDays = reviewCycleDays
  }

  const nextTeaching: Record<string, unknown> = {
    ...currentTeaching,
    updatedAt: new Date().toISOString(),
  }
  if (teacherType) nextTeaching.teacherType = teacherType
  if (assignedTeacherUserId) nextTeaching.assignedTeacherUserId = assignedTeacherUserId
  if (recurrenceUnit) nextTeaching.recurrenceUnit = recurrenceUnit
  if (typeof recurrenceInterval === "number") nextTeaching.recurrenceInterval = recurrenceInterval
  if (typeof payload.courseSlugs !== "undefined") nextTeaching.courseSlugs = courseSlugs
  if (typeof payload.weekdays !== "undefined") nextTeaching.weekdays = weekdays
  if (shiftStart) nextTeaching.shiftStart = shiftStart
  if (shiftEnd) nextTeaching.shiftEnd = shiftEnd
  if (typeof weeklyHours === "number") nextTeaching.weeklyHours = weeklyHours
  if (typeof bonusTargetHours === "number") nextTeaching.bonusTargetHours = bonusTargetHours

  const updated = await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...publicMetadata,
      staffPerformance: nextPerformance,
      staffTeaching: nextTeaching,
    },
  })

  const updatedPublicMetadata = asObject(updated.publicMetadata)
  const updatedPerformance = asObject(updatedPublicMetadata.staffPerformance)
  const updatedTeaching = asObject(updatedPublicMetadata.staffTeaching)

  return NextResponse.json({
    ok: true,
    performance: {
      rating:
        typeof updatedPerformance.rating === "number" && Number.isFinite(updatedPerformance.rating)
          ? updatedPerformance.rating
          : null,
      reviewsCount:
        typeof updatedPerformance.reviewsCount === "number" && Number.isFinite(updatedPerformance.reviewsCount)
          ? Math.round(updatedPerformance.reviewsCount)
          : 0,
      reviewCycleDays:
        typeof updatedPerformance.reviewCycleDays === "number" && Number.isFinite(updatedPerformance.reviewCycleDays)
          ? Math.round(updatedPerformance.reviewCycleDays)
          : null,
    },
    teaching: {
      teacherType: typeof updatedTeaching.teacherType === "string" ? updatedTeaching.teacherType : "",
      assignedTeacherUserId:
        typeof updatedTeaching.assignedTeacherUserId === "string" ? updatedTeaching.assignedTeacherUserId : "",
      recurrenceUnit: updatedTeaching.recurrenceUnit === "year" ? "year" : "month",
      recurrenceInterval:
        typeof updatedTeaching.recurrenceInterval === "number" && Number.isFinite(updatedTeaching.recurrenceInterval)
          ? Math.max(1, Math.min(12, Math.round(updatedTeaching.recurrenceInterval)))
          : null,
      courseSlugs: normalizeCourseSlugs(updatedTeaching.courseSlugs),
      weekdays: normalizeWeekdays(updatedTeaching.weekdays),
      shiftStart: normalizeTime(updatedTeaching.shiftStart),
      shiftEnd: normalizeTime(updatedTeaching.shiftEnd),
      weeklyHours:
        typeof updatedTeaching.weeklyHours === "number" && Number.isFinite(updatedTeaching.weeklyHours)
          ? updatedTeaching.weeklyHours
          : null,
      bonusTargetHours:
        typeof updatedTeaching.bonusTargetHours === "number" && Number.isFinite(updatedTeaching.bonusTargetHours)
          ? updatedTeaching.bonusTargetHours
          : null,
    },
  })
}
