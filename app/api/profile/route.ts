import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { validateProfileUpdatePayload } from "@/lib/security/profile-validation"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { awardPointsFromRule, getPointsBalance } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"

export const runtime = "nodejs"
const profileCompletedEventKey = (userId: string) => `profile-completed:${userId}`

const isCompleteProfile = (profile: {
  birthDate: Date | null
  emergencyContactName: string | null
  emergencyContactRelation: string | null
  emergencyContactPhone: string | null
}) => {
  return Boolean(
    profile.birthDate &&
      profile.emergencyContactName?.trim() &&
      profile.emergencyContactRelation?.trim() &&
      profile.emergencyContactPhone?.trim()
  )
}

const toDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:get", getClientIp(req)),
      limit: 90,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phone = clerkUser.primaryPhoneNumber?.phoneNumber || ""
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

    const dbUser = await upsertUserByIdentifiers({
      clerkId: authResult.userId,
      email,
      name,
      phone,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    const profile = await prisma.studentProfile.findUnique({
      where: { userId: dbUser.id },
      include: { billingAddress: true },
    })
    const completedPurchases = await prisma.purchase.count({
      where: {
        userId: dbUser.id,
        status: { in: SUCCESSFUL_PURCHASE_STATUSES },
      },
    })

    const pointsBalance = await getPointsBalance(dbUser.id)

    const completion = profile ? isCompleteProfile(profile) : false

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        phone: dbUser.phone,
        name: name || dbUser.name || "",
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
        status: completedPurchases > 0 ? "ACTIVE" : "NEW",
      },
      profile,
      pointsBalance,
      profileComplete: completion,
    })
  } catch (error) {
    console.error("Profile GET failed", error)
    return NextResponse.json({ error: "Unable to load profile" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:put", getClientIp(req)),
      limit: 25,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: unknown

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsedBody = validateProfileUpdatePayload(body)
    if ("status" in parsedBody) {
      return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phone = clerkUser.primaryPhoneNumber?.phoneNumber || ""

    const firstName = parsedBody.firstName
    const lastName = parsedBody.lastName

    if ((firstName && firstName !== clerkUser.firstName) || (lastName && lastName !== clerkUser.lastName)) {
      await client.users.updateUser(authResult.userId, {
        firstName: firstName || clerkUser.firstName || "",
        lastName: lastName || clerkUser.lastName || "",
      })
    }

    const dbUser = await upsertUserByIdentifiers({
      clerkId: authResult.userId,
      email,
      name: [firstName || clerkUser.firstName, lastName || clerkUser.lastName].filter(Boolean).join(" "),
      phone,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    const profile = await prisma.studentProfile.upsert({
      where: { userId: dbUser.id },
      create: {
        userId: dbUser.id,
        firstName,
        lastName,
        birthDate: toDate(parsedBody.birthDate),
        emergencyContactName: parsedBody.emergencyContactName || null,
        emergencyContactRelation: parsedBody.emergencyContactRelation || null,
        emergencyContactPhone: parsedBody.emergencyContactPhone || null,
      },
      update: {
        firstName,
        lastName,
        birthDate: toDate(parsedBody.birthDate),
        emergencyContactName: parsedBody.emergencyContactName || null,
        emergencyContactRelation: parsedBody.emergencyContactRelation || null,
        emergencyContactPhone: parsedBody.emergencyContactPhone || null,
      },
    })

    if (parsedBody.billingAddress === null) {
      await prisma.billingAddress.deleteMany({
        where: { profileId: profile.id },
      })
    } else if (parsedBody.billingAddress) {
      await prisma.billingAddress.upsert({
        where: { profileId: profile.id },
        create: {
          profileId: profile.id,
          line1: parsedBody.billingAddress.line1,
          line2: parsedBody.billingAddress.line2 || null,
          city: parsedBody.billingAddress.city,
          state: parsedBody.billingAddress.state,
          postalCode: parsedBody.billingAddress.postalCode,
          country: parsedBody.billingAddress.country,
        },
        update: {
          line1: parsedBody.billingAddress.line1,
          line2: parsedBody.billingAddress.line2 || null,
          city: parsedBody.billingAddress.city,
          state: parsedBody.billingAddress.state,
          postalCode: parsedBody.billingAddress.postalCode,
          country: parsedBody.billingAddress.country,
        },
      })
    }

    const updatedProfile = await prisma.studentProfile.findUnique({
      where: { userId: dbUser.id },
      include: { billingAddress: true },
    })

    const complete = updatedProfile ? isCompleteProfile(updatedProfile) : false

    if (complete) {
      await awardPointsFromRule({
        userId: dbUser.id,
        ruleKey: POINTS_RULE_KEYS.PROFILE_COMPLETED,
        eventKey: profileCompletedEventKey(dbUser.id),
        meta: { source: "profile" },
      })
    }

    const pointsBalance = await getPointsBalance(dbUser.id)

    return NextResponse.json({
      profile: updatedProfile,
      pointsBalance,
      profileComplete: complete,
    })
  } catch (error) {
    console.error("Profile PUT failed", error)
    return NextResponse.json({ error: "Unable to save profile" }, { status: 500 })
  }
}
