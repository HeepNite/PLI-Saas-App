import type { NestGatewayRoute } from "./config"
import type { NestGatewayFallbackReason } from "./fallback"

export type NestGatewayFallbackStatusClass = "2xx" | "4xx" | "5xx"

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

type NestGatewayFallbackLogger = Pick<Console, "info" | "warn">

const EXPECTED_FALLBACK_REASONS: ReadonlySet<NestGatewayFallbackReason> = new Set(["disabled", "missing_config"])

export const isExpectedNestGatewayFallback = (reason: NestGatewayFallbackReason) => EXPECTED_FALLBACK_REASONS.has(reason)

export const getNestGatewayStatusClass = (status?: number): NestGatewayFallbackStatusClass | undefined => {
  if (status === undefined) return undefined
  if (status >= 200 && status < 300) return "2xx"
  if (status >= 400 && status < 500) return "4xx"
  if (status >= 500 && status < 600) return "5xx"
  return undefined
}

export const createConsoleNestGatewayFallbackReporter = (
  logger: NestGatewayFallbackLogger = console
): NestGatewayFallbackReporter => {
  return (event) => {
    const log = event.expected ? logger.info : logger.warn
    log("[nest-gateway:fallback]", event)
  }
}

export const defaultNestGatewayFallbackReporter = createConsoleNestGatewayFallbackReporter()
