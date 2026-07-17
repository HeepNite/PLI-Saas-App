import { buildQrBootstrapDecisionResponse } from "@/lib/checkin/qr-decision"
import type {
  CheckinQrDecisionGatewayRequest,
  CheckinQrDecisionGatewayResponse,
} from "@/lib/nest-gateway/contracts/checkin-qr-decision"

export class QrDecisionService {
  constructor(
    private readonly buildDecisionResponse: (
      input: CheckinQrDecisionGatewayRequest
    ) => Promise<CheckinQrDecisionGatewayResponse> = buildQrBootstrapDecisionResponse
  ) {}

  async getQrDecision(input: CheckinQrDecisionGatewayRequest): Promise<CheckinQrDecisionGatewayResponse> {
    return this.buildDecisionResponse(input)
  }
}
