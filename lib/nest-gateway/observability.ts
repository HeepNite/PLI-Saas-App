import type { NestGatewayRoute } from "./config"
import type { NestGatewayFallbackReason } from "./fallback"

export type NestGatewayFallbackStatusClass = "4xx" | "5xx"

export type NestGatewayFallbackEvent = {
  expected: boolean
  reason: NestGatewayFallbackReason
  requestId?: string
  route: NestGatewayRoute
  status?: number
  statusClass?: NestGatewayFallbackStatusClass
  timeoutMs: number
}

export type NestGatewayFallbackReporter = (event: NestGatewayFallbackEvent) => void

const EXPECTED_FALLBACK_REASONS: ReadonlySet<NestGatewayFallbackReason> = new Set(["disabled", "missing_config"])

export const isExpectedNestGatewayFallback = (reason: NestGatewayFallbackReason) => EXPECTED_FALLBACK_REASONS.has(reason)

export const getNestGatewayStatusClass = (status?: number): NestGatewayFallbackStatusClass | undefined => {
  if (status === undefined) return undefined
  if (status >= 400 && status < 500) return "4xx"
  if (status >= 500 && status < 600) return "5xx"
  return undefined
}

export const createConsoleNestGatewayFallbackReporter = (
  logger: Pick<Console, "warn"> = console
): NestGatewayFallbackReporter => {
  return (event) => {
    logger.warn("[nest-gateway:fallback]", event)
  }
}

export const defaultNestGatewayFallbackReporter = createConsoleNestGatewayFallbackReporter()
