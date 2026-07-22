import Stripe from "stripe"
import type {
  TerminalPaymentIntentGatewayRequest,
  TerminalPaymentIntentGatewayResponse,
} from "@/lib/nest-gateway/contracts/terminal-payment-intents"

type StripePaymentIntentPort = {
  client_secret: string | null
}

type StripePaymentIntentsPort = {
  create: (
    params: Stripe.PaymentIntentCreateParams,
    options?: { idempotencyKey?: string }
  ) => Promise<StripePaymentIntentPort>
}

type StripeClientPort = {
  paymentIntents: StripePaymentIntentsPort
}

const secret = process.env.STRIPE_SECRET_KEY
const stripeClient = secret
  ? new Stripe(secret, {
      apiVersion: "2026-01-28.clover",
    })
  : null

export const createStripeTerminalPaymentIntent = async (
  client: StripeClientPort | null,
  input: TerminalPaymentIntentGatewayRequest
): Promise<TerminalPaymentIntentGatewayResponse> => {
  if (!client) {
    throw new Error("Stripe not configured")
  }

  const intent = await client.paymentIntents.create(
    {
      amount: input.amount,
      currency: input.currency,
      payment_method_types: ["card_present"],
      receipt_email: input.receiptEmail,
      metadata: input.metadata,
    },
    {
      idempotencyKey: input.idempotencyKey,
    }
  )

  if (!intent.client_secret?.trim()) {
    throw new Error("Stripe payment intent missing client secret")
  }

  return { clientSecret: intent.client_secret }
}

export class PaymentIntentsService {
  constructor(private readonly client: StripeClientPort | null = stripeClient) {}

  async createPaymentIntent(input: TerminalPaymentIntentGatewayRequest): Promise<TerminalPaymentIntentGatewayResponse> {
    return createStripeTerminalPaymentIntent(this.client, input)
  }
}
