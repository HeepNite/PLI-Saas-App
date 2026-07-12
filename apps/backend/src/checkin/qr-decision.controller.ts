import { QrDecisionService } from "./qr-decision.service"
import type {
  CheckinQrDecisionGatewayRequest,
  CheckinQrDecisionGatewayResponse,
} from "@/lib/nest-gateway/contracts/checkin-qr-decision"

type QrDecisionServicePort = Pick<QrDecisionService, "getQrDecision">

export class QrDecisionController {
  constructor(private readonly qrDecisionService: QrDecisionServicePort = new QrDecisionService()) {}

  async getQrDecision(input: CheckinQrDecisionGatewayRequest): Promise<CheckinQrDecisionGatewayResponse> {
    return this.qrDecisionService.getQrDecision(input)
  }
}
