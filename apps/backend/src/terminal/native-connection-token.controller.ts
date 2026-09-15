import { ConnectionTokenService } from "./connection-token.service"
import {
  NATIVE_CONNECTION_TOKEN_SCOPE,
  NativeReaderAuthService,
} from "./native-reader-auth.service"
import { getClientIp } from "@/lib/security/rate-limit"

type NativeReaderAuthPort = Pick<NativeReaderAuthService, "authorize">
type ConnectionTokenServicePort = Pick<ConnectionTokenService, "createConnectionToken">

export class NativeConnectionTokenController {
  constructor(
    private readonly auth: NativeReaderAuthPort = new NativeReaderAuthService(),
    private readonly connectionTokens: ConnectionTokenServicePort = new ConnectionTokenService()
  ) {}

  async post(request: Request) {
    const reader = await this.auth.authorize({
      authorization: request.headers.get("authorization"),
      ipAddress: getClientIp(request),
      requiredScope: NATIVE_CONNECTION_TOKEN_SCOPE,
    })
    return this.connectionTokens.createConnectionToken({
      sessionId: reader.id,
      terminalId: reader.id,
      terminalSlug: reader.id,
      terminalName: reader.name,
      terminalLocation: null,
    })
  }
}
