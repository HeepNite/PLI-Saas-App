import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { userId: staffUserId } = await auth()
  if (!staffUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
  const courseSlug = typeof payload?.courseSlug === "string" ? payload.courseSlug.trim() : ""
  const customerUserId = typeof payload?.customerUserId === "string" ? payload.customerUserId.trim() : ""

  if (!customerUserId) {
    return NextResponse.json(
      { error: "customerUserId is required." },
      { status: 400 }
    )
  }

  if (!courseSlug) {
    return NextResponse.json(
      { error: "courseSlug is required." },
      { status: 400 }
    )
  }

  try {
    const previousPurchase = await prisma.packagePurchase.findFirst({
      where: {
        userId: customerUserId,
        courseSlug,
        status: { in: ["expired", "exhausted"] },
      },
      select: { packageId: true },
      orderBy: { purchasedAt: "desc" },
    })

    return NextResponse.json({
      previousPackageId: previousPurchase?.packageId || null,
    })
  } catch (error) {
    console.error("previous-package lookup failed", error)
    return NextResponse.json(
      { error: "Unable to look up previous package" },
      { status: 500 }
    )
  }
}
