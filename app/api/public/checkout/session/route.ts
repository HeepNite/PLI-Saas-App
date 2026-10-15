import { POST as createCheckoutSession } from "@/app/api/checkout/session/route"
import { runWithTrustedCheckoutChannel } from "@/lib/checkout/trusted-checkout-channel"

export const runtime = "nodejs"

export async function POST(req: Request) {
  return runWithTrustedCheckoutChannel("public_booking", () => createCheckoutSession(req))
}
