import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { POST as createCheckoutSession } from "@/app/api/checkout/session/route"
import { runWithTrustedCheckoutChannel } from "@/lib/checkout/trusted-checkout-channel"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return runWithTrustedCheckoutChannel("profile", () => createCheckoutSession(req))
}
