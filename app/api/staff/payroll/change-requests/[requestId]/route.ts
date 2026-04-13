import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { jsonError, readJsonBody } from "@/lib/payroll/route-helpers"

export const runtime = "nodejs"

export async function PATCH(
  req: Request,
  context: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await context.params
  const authResult = await authorizeStaffPortalRequest() // Owner or Manager
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const { status, rejectionReason } = parsedBody.body as {
    status: "approved" | "rejected"
    rejectionReason?: string
  }

  if (status !== "approved" && status !== "rejected") {
    return jsonError("Invalid status. Must be 'approved' or 'rejected'.", 422)
  }

  try {
    const request = await prisma.staffPaymentChangeRequest.findUnique({
      where: { id: requestId },
    })

    if (!request) {
      return jsonError("Request not found", 404)
    }

    if (request.status !== "pending") {
      return jsonError("Request is already finalized", 409)
    }

    if (status === "approved") {
      const rawInfo = request.requestedInfo as unknown
      const paymentInfo = rawInfo === null || rawInfo === Prisma.DbNull
        ? Prisma.JsonNull
        : request.requestedInfo as Prisma.InputJsonValue

      // Execute the change in StaffAccount
      await prisma.$transaction([
        prisma.staffAccount.update({
          where: { id: request.staffAccountId },
          data: {
            paymentPreference: request.requestedMethod,
            paymentInfo,
          },
        }),
        prisma.staffPaymentChangeRequest.update({
          where: { id: requestId },
          data: {
            status: "approved",
            reviewedBy: authResult.userId,
            reviewedAt: new Date(),
          },
        }),
      ])
    } else {
      await prisma.staffPaymentChangeRequest.update({
        where: { id: requestId },
        data: {
          status: "rejected",
          rejectionReason,
          reviewedBy: authResult.userId,
          reviewedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PATCH /api/staff/payroll/change-requests/[requestId] failed", error)
    return jsonError("Failed to update change request", 500)
  }
}
