import type { NestGatewayConfig } from "./config"

export const INTERNAL_AUTH_HEADER = "x-internal-service-secret"
export const REQUEST_ID_HEADER = "x-request-id"

export const createNestGatewayHeaders = (config: Pick<NestGatewayConfig, "sharedSecret">, requestId?: string) => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    [INTERNAL_AUTH_HEADER]: config.sharedSecret,
  }

  if (requestId) headers[REQUEST_ID_HEADER] = requestId

  return headers
}
