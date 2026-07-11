export type NestGatewayFallbackReason = "disabled" | "missing_config" | "timeout" | "unauthorized" | "upstream_error"

export type NestGatewayFallbackResult = {
  ok: false
  reason: NestGatewayFallbackReason
  service: "next"
  source: "fallback"
}

export const createNestGatewayFallback = (reason: NestGatewayFallbackReason): NestGatewayFallbackResult => ({
  ok: false,
  reason,
  service: "next",
  source: "fallback",
})

export const classifyNestGatewayFailure = (error: unknown): NestGatewayFallbackReason => {
  if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return "timeout"
  return "upstream_error"
}
