import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalBaseRequest, authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { jsonError, readJsonBody } from "@/lib/payroll/route-helpers"

export const runtime = "nodejs"

// GET /api/staff/payroll/change-requests - Admin lists all requests
export async function GET() {
  const authResult = await authorizeStaffPortalRequest() // Owner or Manager
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const items = await prisma.staffPaymentChangeRequest.findMany({
      select: {
        id: true,
        staffAccountId: true,
        requestedMethod: true,
        requestedInfo: true,
        reason: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const staffAccountIds = [...new Set(items.map((item) => item.staffAccountId))]
    const staffAccounts =
      staffAccountIds.length > 0
        ? await prisma.staffAccount.findMany({
            where: { id: { in: staffAccountIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          })
        : []

    const staffAccountById = new Map(staffAccounts.map((account) => [account.id, account]))

    return NextResponse.json({
      items: items.map((item) => {
        const staffAccount = staffAccountById.get(item.staffAccountId)

        return {
          ...item,
          staffAccount: {
            firstName: staffAccount?.firstName ?? "",
            lastName: staffAccount?.lastName ?? "",
            email: staffAccount?.email ?? "",
          },
        }
      }),
    })
  } catch (error) {
    console.error("GET /api/staff/payroll/change-requests failed", error)
    return jsonError("Failed to load change requests", 500)
  }
}

// POST /api/staff/payroll/change-requests - Staff creates a new request
export async function POST(req: Request) {
  const authResult = await authorizeStaffPortalBaseRequest() // Any staff
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const { requestedMethod, requestedInfo, reason } = parsedBody.body as {
    requestedMethod: string
    requestedInfo?: Prisma.InputJsonValue
    reason?: string
  }

  if (!requestedMethod) {
    return jsonError("Requested method is required", 422)
  }

  try {
    const staffAccount = await prisma.staffAccount.findUnique({
      where: { clerkUserId: authResult.userId },
      select: { id: true },
    })

    if (!staffAccount) {
      return jsonError("Staff account not found", 404)
    }

    // Cancel any existing pending requests for this staff
    await prisma.staffPaymentChangeRequest.updateMany({
      where: {
        staffAccountId: staffAccount.id,
        status: "pending",
      },
      data: {
        status: "cancelled",
      },
    })

    const created = await prisma.staffPaymentChangeRequest.create({
      data: {
        staffAccountId: staffAccount.id,
        requestedMethod,
        requestedInfo: requestedInfo || {},
        reason,
        status: "pending",
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("POST /api/staff/payroll/change-requests failed", error)
    return jsonError("Failed to create change request", 500)
  }
}
