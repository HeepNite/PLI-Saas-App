import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:students:package-plans:get", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } })
  }

  const auth = await authorizeStudentOperationalRequest()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const items = await prisma.packagePlan.findMany({
    where: { active: true },
    orderBy: { label: "asc" },
    select: { id: true, label: true, priceCents: true },
  })
  return NextResponse.json({ items })
}
