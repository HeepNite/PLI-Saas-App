import { POST as createCheckoutIntent } from "@/app/api/checkout/intent/route"
import { runWithTrustedCheckoutChannel } from "@/lib/checkout/trusted-checkout-channel"

export const runtime = "nodejs"

export async function POST(req: Request) {
  return runWithTrustedCheckoutChannel("public_booking", () => createCheckoutIntent(req))
}
