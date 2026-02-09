import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"

export const runtime = "nodejs"
const PROFILE_COMPLETE_POINTS = 10

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

export async function GET() {
  try {
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

    const pointsBalance = await prisma.pointsLedger.aggregate({
      where: { userId: dbUser.id },
      _sum: { points: true },
    })

    const completion = profile ? isCompleteProfile(profile) : false

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        phone: dbUser.phone,
        name: name || dbUser.name || "",
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
      },
      profile,
      pointsBalance: pointsBalance._sum.points || 0,
      profileComplete: completion,
    })
  } catch (error) {
    console.error("Profile GET failed", error)
    return NextResponse.json({ error: "Unable to load profile" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: {
      firstName?: string
      lastName?: string
      birthDate?: string
      emergencyContactName?: string
      emergencyContactRelation?: string
      emergencyContactPhone?: string
      billingAddress?: {
        line1: string
        line2?: string | null
        city: string
        state: string
        postalCode: string
        country: string
      } | null
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phone = clerkUser.primaryPhoneNumber?.phoneNumber || ""

    const firstName = body.firstName?.trim()
    const lastName = body.lastName?.trim()

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
        birthDate: toDate(body.birthDate),
        emergencyContactName: body.emergencyContactName?.trim() || null,
        emergencyContactRelation: body.emergencyContactRelation?.trim() || null,
        emergencyContactPhone: body.emergencyContactPhone?.trim() || null,
      },
      update: {
        firstName,
        lastName,
        birthDate: toDate(body.birthDate),
        emergencyContactName: body.emergencyContactName?.trim() || null,
        emergencyContactRelation: body.emergencyContactRelation?.trim() || null,
        emergencyContactPhone: body.emergencyContactPhone?.trim() || null,
      },
    })

    if (body.billingAddress) {
      await prisma.billingAddress.upsert({
        where: { profileId: profile.id },
        create: {
          profileId: profile.id,
          line1: body.billingAddress.line1,
          line2: body.billingAddress.line2 || null,
          city: body.billingAddress.city,
          state: body.billingAddress.state,
          postalCode: body.billingAddress.postalCode,
          country: body.billingAddress.country,
        },
        update: {
          line1: body.billingAddress.line1,
          line2: body.billingAddress.line2 || null,
          city: body.billingAddress.city,
          state: body.billingAddress.state,
          postalCode: body.billingAddress.postalCode,
          country: body.billingAddress.country,
        },
      })
    }

    const updatedProfile = await prisma.studentProfile.findUnique({
      where: { userId: dbUser.id },
      include: { billingAddress: true },
    })

    const complete = updatedProfile ? isCompleteProfile(updatedProfile) : false

    if (complete) {
      const existingReward = await prisma.pointsLedger.findFirst({
        where: { userId: dbUser.id, type: "PROFILE_COMPLETED" },
      })
      if (!existingReward) {
        await prisma.pointsLedger.create({
          data: {
            userId: dbUser.id,
            type: "PROFILE_COMPLETED",
            points: PROFILE_COMPLETE_POINTS,
            meta: { source: "profile" },
          },
        })
      }
    }

    const pointsBalance = await prisma.pointsLedger.aggregate({
      where: { userId: dbUser.id },
      _sum: { points: true },
    })

    return NextResponse.json({
      profile: updatedProfile,
      pointsBalance: pointsBalance._sum.points || 0,
      profileComplete: complete,
    })
  } catch (error) {
    console.error("Profile PUT failed", error)
    return NextResponse.json({ error: "Unable to save profile" }, { status: 500 })
  }
}
