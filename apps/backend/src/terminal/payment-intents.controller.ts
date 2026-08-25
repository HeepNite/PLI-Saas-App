import { PaymentIntentsService } from "./payment-intents.service"
import type {
  TerminalPaymentIntentGatewayRequest,
  TerminalPaymentIntentGatewayResponse,
} from "@/lib/nest-gateway/contracts/terminal-payment-intents"

type PaymentIntentsServicePort = Pick<PaymentIntentsService, "createPaymentIntent">

export class PaymentIntentsController {
  constructor(private readonly paymentIntentsService: PaymentIntentsServicePort = new PaymentIntentsService()) {}

  async post(input: TerminalPaymentIntentGatewayRequest): Promise<TerminalPaymentIntentGatewayResponse> {
    return this.paymentIntentsService.createPaymentIntent(input)
  }
}
