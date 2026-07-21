import Stripe from "stripe"
import type {
  TerminalConnectionTokenGatewayRequest,
  TerminalConnectionTokenGatewayResponse,
} from "@/lib/nest-gateway/contracts/terminal-precutover"

const secret = process.env.STRIPE_SECRET_KEY
const stripe = secret
  ? new Stripe(secret, {
      apiVersion: "2026-01-28.clover",
    })
  : null

const createTerminalConnectionToken = async (
  input: TerminalConnectionTokenGatewayRequest
): Promise<TerminalConnectionTokenGatewayResponse> => {
  void input
  if (!stripe) {
    throw new Error("Stripe not configured")
  }

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
