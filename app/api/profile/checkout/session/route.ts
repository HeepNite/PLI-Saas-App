import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { handleCheckoutSession } from "@/app/api/checkout/session/route"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return handleCheckoutSession(req, "profile")
}
