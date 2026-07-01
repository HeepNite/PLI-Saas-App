import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { jsonError } from "@/lib/payroll/route-helpers"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:unavailability:post", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalBaseRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON body", 400)
  }

  const payload = body as Record<string, unknown>
  
  // Validate required fields
  const startDateStr = typeof payload.startDate === "string" ? payload.startDate : undefined
  const endDateStr = typeof payload.endDate === "string" ? payload.endDate : undefined
  const type = typeof payload.type === "string" ? payload.type.trim() : undefined
  const note = typeof payload.note === "string" ? payload.note.trim() : undefined

  if (!startDateStr || !endDateStr || !type) {
    return jsonError("Missing required fields: startDate, endDate, type", 422)
  }

  // Validate date format and logic
  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Set to start of today for comparison

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return jsonError("Invalid date format", 422)
  }

  if (startDate < today) {
    return jsonError("Start date must be today or in the future", 422)
  }

  if (startDate > endDate) {
    return jsonError("Start date must be before or equal to end date", 422)
  }

  // Validate type
  const validTypes = ["day_off", "sick_leave", "suspension", "other"]
  if (!validTypes.includes(type)) {
    return jsonError("Invalid type. Must be one of: day_off, sick_leave, suspension, other", 422)
  }

  // Create the unavailability request
  const created = await prisma.staffUnavailabilityRequest.create({
    data: {
      staffAccountId: authResult.userId,
      startDate,
      endDate,
      type,
      note: note || null,
      status: "pending",
    },
  })

  // Notification stub (log for now)
  console.log(`Staff unavailability request created: ${created.id} for staff ${authResult.userId}`)

  return NextResponse.json(
    {
      id: created.id,
      staffAccountId: created.staffAccountId,
      startDate: created.startDate.toISOString(),
      endDate: created.endDate.toISOString(),
      type: created.type,
      note: created.note,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    { status: 201 }
  )
}