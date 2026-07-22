export type NestGatewayFallbackReason = "disabled" | "missing_config" | "timeout" | "unauthorized" | "upstream_error"

export type NestGatewayFallbackResult = {
  ok: false
  reason: NestGatewayFallbackReason
  service: "next"
  source: "fallback"
}

export type NestGatewayUnknownStateReason = Exclude<NestGatewayFallbackReason, "disabled" | "missing_config">

export type NestGatewayUnknownStateResult = {
  ok: false
  reason: NestGatewayUnknownStateReason
  service: "nest"
  source: "unknown_state"
}

export const createNestGatewayFallback = (reason: NestGatewayFallbackReason): NestGatewayFallbackResult => ({
  ok: false,
  reason,
  service: "next",
  source: "fallback",
})

export const createNestGatewayUnknownState = (
  reason: NestGatewayUnknownStateReason
): NestGatewayUnknownStateResult => ({
  ok: false,
  reason,
  service: "nest",
  source: "unknown_state",
})

export const classifyNestGatewayFailure = (error: unknown): NestGatewayFallbackReason => {
  if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return "timeout"
  return "upstream_error"
}
