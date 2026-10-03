import Stripe from "stripe"
import type {
  TerminalConnectionTokenGatewayRequest,
  TerminalConnectionTokenGatewayResponse,
} from "@/lib/nest-gateway/contracts/terminal-precutover"

const createTerminalConnectionToken = async (
  input: TerminalConnectionTokenGatewayRequest
): Promise<TerminalConnectionTokenGatewayResponse> => {
  void input
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error("Stripe not configured")
  }

  // Resolve the ordinary client only when the default adapter is used.
  const stripe = new Stripe(secret, { apiVersion: "2026-01-28.clover" })
  const token = await stripe.terminal.connectionTokens.create()
  return { secret: token.secret }
}

export class ConnectionTokenService {
  constructor(
    private readonly createStripeConnectionToken: (
      input: TerminalConnectionTokenGatewayRequest
    ) => Promise<TerminalConnectionTokenGatewayResponse> = createTerminalConnectionToken
  ) {}

  async createConnectionToken(input: TerminalConnectionTokenGatewayRequest): Promise<TerminalConnectionTokenGatewayResponse> {
    return this.createStripeConnectionToken(input)
  }
}
