import { ConnectionTokenService } from "./connection-token.service"
import type {
  TerminalConnectionTokenGatewayRequest,
  TerminalConnectionTokenGatewayResponse,
} from "@/lib/nest-gateway/contracts/terminal-precutover"

type ConnectionTokenServicePort = Pick<ConnectionTokenService, "createConnectionToken">

export class ConnectionTokenController {
  constructor(private readonly connectionTokenService: ConnectionTokenServicePort = new ConnectionTokenService()) {}

  async post(input: TerminalConnectionTokenGatewayRequest): Promise<TerminalConnectionTokenGatewayResponse> {
    return this.connectionTokenService.createConnectionToken(input)
  }
}
