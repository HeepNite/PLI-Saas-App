import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

/**
 * Tells the QR booking flow whether the CURRENT signed-in customer is an
 * established customer. New students are signed into Clerk mid-flow by SMS
 * verification, so `isSignedIn` alone wrongly flips them to existing-customer
 * (drop-in) pricing on any booking restart. A user with NO completed purchase
 * AND NO package is still a new student and keeps the $15 promo.
 */
export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("checkin:qr:new-student:eligibility", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const { userId } = await auth()
  if (!userId) {
    // Not signed in → cannot be an established customer.
    return NextResponse.json({ isExistingCustomer: false })
  }

  const dbUser = await prisma.user.findFirst({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!dbUser) {
    return NextResponse.json({ isExistingCustomer: false })
  }

  const [completedPurchase, anyPackage] = await Promise.all([
    prisma.purchase.findFirst({
      where: { userId: dbUser.id, status: { in: SUCCESSFUL_PURCHASE_STATUSES } },
      select: { id: true },
    }),
    prisma.packagePurchase.findFirst({
      where: { userId: dbUser.id },
      select: { id: true },
    }),
  ])

  return NextResponse.json({ isExistingCustomer: Boolean(completedPurchase || anyPackage) })
}
