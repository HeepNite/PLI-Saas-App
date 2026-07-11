import { createNestGatewayHeaders } from "./auth"
import { getNestGatewayConfig, isNestGatewayRouteEnabled } from "./config"
import {
  classifyNestGatewayFailure,
  createNestGatewayFallback,
  type NestGatewayFallbackResult,
  type NestGatewayFallbackReason,
} from "./fallback"
import {
  defaultNestGatewayFallbackReporter,
  getNestGatewayStatusClass,
  isExpectedNestGatewayFallback,
  type NestGatewayFallbackReporter,
} from "./observability"

type NestHealthSuccess = {
  ok: true
  service: "nest"
  source: "nest"
}

export type NestGatewayHealthResult = NestHealthSuccess | NestGatewayFallbackResult

type NestGatewayHealthOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  requestId?: string
  reporter?: NestGatewayFallbackReporter
}

const HEALTH_ROUTE = "internal-health"

const reportFallback = ({
  reporter,
  reason,
  requestId,
  status,
  timeoutMs,
}: {
  reporter: NestGatewayFallbackReporter
  reason: NestGatewayFallbackReason
  requestId?: string
  status?: number
  timeoutMs: number
}) => {
  reporter({
    expected: isExpectedNestGatewayFallback(reason),
    reason,
    requestId,
    route: HEALTH_ROUTE,
    status,
    statusClass: getNestGatewayStatusClass(status),
    timeoutMs,
  })
}

export const getNestGatewayHealth = async ({
  env = process.env,
  fetchImpl = fetch,
  requestId,
  reporter = defaultNestGatewayFallbackReporter,
}: NestGatewayHealthOptions = {}): Promise<NestGatewayHealthResult> => {
  const config = getNestGatewayConfig(env)
  if (!config.enabled || !isNestGatewayRouteEnabled(config, HEALTH_ROUTE)) {
    const reason = "disabled"
    reportFallback({ reporter, reason, requestId, timeoutMs: config.timeoutMs })
    return createNestGatewayFallback(reason)
  }

  if (!config.baseUrl || !config.sharedSecret) {
    const reason = "missing_config"
    reportFallback({ reporter, reason, requestId, timeoutMs: config.timeoutMs })
    return createNestGatewayFallback(reason)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetchImpl(`${config.baseUrl}/internal/health`, {
      method: "GET",
      headers: createNestGatewayHeaders(config, requestId),
      signal: controller.signal,
      cache: "no-store",
    })

    if (response.status === 401 || response.status === 403) {
      const reason = "unauthorized"
      reportFallback({ reporter, reason, requestId, status: response.status, timeoutMs: config.timeoutMs })
      return createNestGatewayFallback(reason)
    }

    if (!response.ok) {
      const reason = "upstream_error"
      reportFallback({ reporter, reason, requestId, status: response.status, timeoutMs: config.timeoutMs })
      return createNestGatewayFallback(reason)
    }

    const payload = (await response.json()) as { ok?: unknown; service?: unknown }
    if (payload.ok === true && payload.service === "nest") {
      return { ok: true, service: "nest", source: "nest" }
    }

    const reason = "upstream_error"
    reportFallback({ reporter, reason, requestId, timeoutMs: config.timeoutMs })
    return createNestGatewayFallback(reason)
  } catch (error) {
    const reason = classifyNestGatewayFailure(error)
    reportFallback({ reporter, reason, requestId, timeoutMs: config.timeoutMs })
    return createNestGatewayFallback(reason)
  } finally {
    clearTimeout(timeout)
  }
}
