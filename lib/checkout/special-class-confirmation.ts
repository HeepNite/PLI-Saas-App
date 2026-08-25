import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"

export type SpecialClassConfirmationState =
  | "confirmed"
  | "finalizing"
  | "not-confirmed"
  | "unavailable"

const SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]{3,200}$/

export async function resolveSpecialClassConfirmation(
  sessionId: string | undefined,
): Promise<{ state: SpecialClassConfirmationState }> {
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) return { state: "unavailable" }
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return { state: "unavailable" }

  try {
    const stripe = new Stripe(secret, { apiVersion: "2026-01-28.clover" })
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.specialEventKey !== SPECIAL_SALSA_CLASS.key) return { state: "unavailable" }
    if (session.payment_status !== "paid") {
      return { state: session.status === "open" ? "not-confirmed" : "unavailable" }
    }

    const purchase = await prisma.purchase.findUnique({
      where: { stripeCheckoutSessionId: session.id },
      select: { status: true },
    })
    return purchase && SUCCESSFUL_PURCHASE_STATUSES.includes(purchase.status)
      ? { state: "confirmed" }
      : { state: "finalizing" }
  } catch {
    return { state: "unavailable" }
  }
}
