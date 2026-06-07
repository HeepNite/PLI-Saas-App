import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerRequest, authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { asOptionalNumber, jsonError, readJsonBody } from "@/lib/payroll/route-helpers"

export const runtime = "nodejs"

// Validate timezone is a valid IANA timezone
function isValidIANATimezone(timezone: string): boolean {
  try {
    // Try to format a date with the timezone - if invalid, it will throw
    new Date().toLocaleString('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// Validate time format HH:MM
function isValidTimeFormat(time: string): boolean {
  return /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(time);
}

// Validate paydayWeekday is 0-6 (Sunday-Saturday)
function isValidPaydayWeekday(weekday: number): boolean {
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6;
}

export async function POST(req: Request) {
  // Authenticate as owner only
  const authResult = await authorizeOwnerRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Parse and validate request body
  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const { staffAccountId, time, timezone, active } = parsedBody.body
  const paydayWeekday = asOptionalNumber(parsedBody.body.paydayWeekday)

  // Validate required fields
  if (!staffAccountId || typeof staffAccountId !== "string") {
    return jsonError("staffAccountId is required", 422)
  }

  if (paydayWeekday === undefined || paydayWeekday === null) {
    return jsonError("paydayWeekday is required", 422)
  }

  if (!time || typeof time !== "string") {
    return jsonError("time is required", 422)
  }

  if (!timezone || typeof timezone !== "string") {
    return jsonError("timezone is required", 422)
  }

  if (active === undefined || active === null) {
    return jsonError("active is required", 422)
  }

  // Validate field values
  if (!isValidPaydayWeekday(paydayWeekday)) {
    return jsonError("paydayWeekday must be an integer between 0 and 6", 422)
  }

  if (!isValidTimeFormat(time)) {
    return jsonError("time must be in HH:MM format (24-hour)", 422)
  }

  if (!isValidIANATimezone(timezone)) {
    return jsonError("timezone must be a valid IANA timezone", 422)
  }

  if (typeof active !== "boolean") {
    return jsonError("active must be a boolean", 422)
  }

  // Verify staff account exists
  const staffAccount = await prisma.staffAccount.findUnique({
    where: { id: staffAccountId },
    select: { id: true }
  })

  if (!staffAccount) {
    return jsonError("Staff account not found", 404)
  }

  // Upsert the payment schedule
  try {
    const schedule = await prisma.staffPaymentSchedule.upsert({
      where: { staffAccountId },
      update: {
        paydayWeekday,
        time,
        timezone,
        active,
        updatedAt: new Date()
      },
      create: {
        staffAccountId,
        paydayWeekday,
        time,
        timezone,
        active
      },
      select: {
        id: true,
        staffAccountId: true,
        paydayWeekday: true,
        time: true,
        timezone: true,
        active: true,
        nextRunAt: true,
        lastRunAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Return 201 if created, 200 if updated
    const isNew = schedule.createdAt.getTime() === schedule.updatedAt.getTime()
    return NextResponse.json(schedule, { status: isNew ? 201 : 200 })
  } catch (error) {
    console.error("Error upserting staff payment schedule:", error)
    return jsonError("Failed to create/update payment schedule", 500)
  }
}

export async function GET() {
  // Allow both owner and staff portal access
  const authResult = await authorizeOwnerRequest()
  let staffAuthResult = null
  
  if (!authResult.ok) {
    staffAuthResult = await authorizeStaffPortalRequest()
    if (!staffAuthResult.ok) {
      return NextResponse.json({ error: staffAuthResult.error }, { status: staffAuthResult.status })
    }
  }

  try {
    const schedules = await prisma.staffPaymentSchedule.findMany({
      include: {
        staffAccount: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        staffAccount: {
          firstName: 'asc',
          lastName: 'asc'
        }
      }
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error("Error fetching staff payment schedules:", error)
    return jsonError("Failed to fetch payment schedules", 500)
  }
}
