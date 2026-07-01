import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { jsonError } from "@/lib/payroll/route-helpers"

export const runtime = "nodejs"

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:unavailability:delete", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  const { id } = await context.params
  if (!id) {
    return jsonError("Missing unavailability ID", 400)
  }

  // Find the unavailability request
  const unavailabilityRequest = await prisma.staffUnavailabilityRequest.findUnique({
    where: { id },
  })

  if (!unavailabilityRequest) {
    return jsonError("Unavailability request not found", 404)
  }

  // Check if the authenticated user owns this request
  if (unavailabilityRequest.staffAccountId !== authResult.userId) {
    return jsonError("Unauthorized to cancel this request", 403)
  }

  // Check if request is still pending
  if (unavailabilityRequest.status !== "pending") {
    return jsonError("Only pending requests can be cancelled", 422)
  }

  // Cancel the request
  const updated = await prisma.staffUnavailabilityRequest.update({
    where: { id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
    },
  })

  // Notification stub (log for now)
  console.log(`Staff unavailability request cancelled: ${updated.id} by staff ${authResult.userId}`)

  return NextResponse.json({
    id: updated.id,
    staffAccountId: updated.staffAccountId,
    startDate: updated.startDate.toISOString(),
    endDate: updated.endDate.toISOString(),
    type: updated.type,
    note: updated.note,
    status: updated.status,
    reviewedBy: updated.reviewedBy,
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    cancelledAt: updated.cancelledAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  })
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:unavailability:patch", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  const { id } = await context.params
  if (!id) {
    return jsonError("Missing unavailability ID", 400)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON body", 400)
  }

  const payload = body as Record<string, unknown>
  const status = typeof payload.status === "string" ? payload.status.trim() : undefined
  const note = typeof payload.note === "string" ? payload.note.trim() : undefined

  // Validate status
  if (!status || !["approved", "rejected"].includes(status)) {
    return jsonError("Invalid status. Must be 'approved' or 'rejected'.", 422)
  }

  // Find the unavailability request
  const unavailabilityRequest = await prisma.staffUnavailabilityRequest.findUnique({
    where: { id },
  })

  if (!unavailabilityRequest) {
    return jsonError("Unavailability request not found", 404)
  }

  // Check if already reviewed
  if (unavailabilityRequest.status !== "pending") {
    return jsonError("Unavailability request has already been reviewed", 409)
  }

  // Update the request
  const updated = await prisma.staffUnavailabilityRequest.update({
    where: { id },
    data: {
      status,
      reviewedBy: authResult.userId,
      reviewedAt: new Date(),
      ...(note && { note }), // Only update note if provided
    },
  })

  // Notification stub (log for now)
  console.log(`Staff unavailability request ${status}: ${updated.id} by staff ${authResult.userId}`)

  return NextResponse.json({
    id: updated.id,
    staffAccountId: updated.staffAccountId,
    startDate: updated.startDate.toISOString(),
    endDate: updated.endDate.toISOString(),
    type: updated.type,
    note: updated.note,
    status: updated.status,
    reviewedBy: updated.reviewedBy,
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    cancelledAt: updated.cancelledAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  })
}