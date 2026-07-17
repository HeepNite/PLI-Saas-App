import { createNestGatewayHeaders } from "./auth"
import { getNestGatewayConfig, isNestGatewayRouteEnabled, type NestGatewayRoute } from "./config"
import {
  classifyNestGatewayFailure,
  createNestGatewayFallback,
  type NestGatewayFallbackResult,
  type NestGatewayFallbackReason,
} from "./fallback"
import {
  parseCheckinTodayClassesResponse,
  type CheckinTodayClassesResponse,
} from "./contracts/checkin-today-classes"
import {
  parseCheckinQrDecisionGatewayResponse,
  type CheckinQrDecisionGatewayRequest,
  type CheckinQrDecisionGatewayResponse,
} from "./contracts/checkin-qr-decision"
import {
  defaultNestGatewayFallbackReporter,
  getNestGatewayStatusClass,
  isExpectedNestGatewayFallback,
  type NestGatewayFallbackReporter,
} from "./observability"

type NestHealthPayload = {
  ok: true
  service: "nest"
}

type NestHealthSuccess = NestHealthPayload & {
  source: "nest"
}

export type NestGatewayHealthResult = NestHealthSuccess | NestGatewayFallbackResult
export type NestGatewayTodayClassesResult = CheckinTodayClassesResponse | NestGatewayFallbackResult
export type NestGatewayQrDecisionResult = CheckinQrDecisionGatewayResponse | NestGatewayFallbackResult

type NestGatewayHealthOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  requestId?: string
  reporter?: NestGatewayFallbackReporter
}

type NestGatewayRequestOptions<TSuccess> = NestGatewayHealthOptions & {
  body?: unknown
  method?: "GET" | "POST"
  parseSuccess: (payload: unknown) => TSuccess | null
  path: string
  route: NestGatewayRoute
}

const HEALTH_ROUTE = "internal-health"
const TODAY_CLASSES_ROUTE = "today-classes"
const QR_DECISION_ROUTE = "qr-decision"

const reportFallback = ({
  reporter,
  reason,
  requestId,
  status,
  timeoutMs,
  route,
}: {
  reporter: NestGatewayFallbackReporter
  reason: NestGatewayFallbackReason
  requestId?: string
  route: NestGatewayRoute
  status?: number
  timeoutMs: number
}) => {
  reporter({
    expected: isExpectedNestGatewayFallback(reason),
    reason,
    requestId,
    route,
    status,
    statusClass: getNestGatewayStatusClass(status),
    timeoutMs,
  })
}

const executeNestGatewayRequest = async <TSuccess>({
  env = process.env,
  fetchImpl = fetch,
  parseSuccess,
    body,
    method = "GET",
    path,
  reporter = defaultNestGatewayFallbackReporter,
  requestId,
  route,
}: NestGatewayRequestOptions<TSuccess>): Promise<TSuccess | NestGatewayFallbackResult> => {
  const config = getNestGatewayConfig(env)
  if (!config.enabled || !isNestGatewayRouteEnabled(config, route)) {
    const reason = "disabled"
    reportFallback({ reporter, reason, requestId, route, timeoutMs: config.timeoutMs })
    return createNestGatewayFallback(reason)
  }

  if (!config.baseUrl || !config.sharedSecret) {
    const reason = "missing_config"
    reportFallback({ reporter, reason, requestId, route, timeoutMs: config.timeoutMs })
    return createNestGatewayFallback(reason)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetchImpl(`${config.baseUrl}${path}`, {
      method,
      headers: {
        ...createNestGatewayHeaders(config, requestId),
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    })

    if (response.status === 401 || response.status === 403) {
      const reason = "unauthorized"
      reportFallback({ reporter, reason, requestId, route, status: response.status, timeoutMs: config.timeoutMs })
      return createNestGatewayFallback(reason)
    }

    if (!response.ok) {
      const reason = "upstream_error"
      reportFallback({ reporter, reason, requestId, route, status: response.status, timeoutMs: config.timeoutMs })
      return createNestGatewayFallback(reason)
    }

    const payload = await response.json()
    const parsedPayload = parseSuccess(payload)
    if (parsedPayload) return parsedPayload

    const reason = "upstream_error"
    reportFallback({ reporter, reason, requestId, route, status: response.status, timeoutMs: config.timeoutMs })
    return createNestGatewayFallback(reason)
  } catch (error) {
    const reason = classifyNestGatewayFailure(error)
    reportFallback({ reporter, reason, requestId, route, timeoutMs: config.timeoutMs })
    return createNestGatewayFallback(reason)
  } finally {
    clearTimeout(timeout)
  }
}

export const getNestGatewayHealth = async ({
  env = process.env,
  fetchImpl = fetch,
  requestId,
  reporter = defaultNestGatewayFallbackReporter,
}: NestGatewayHealthOptions = {}): Promise<NestGatewayHealthResult> => {
  const result = await executeNestGatewayRequest<NestHealthPayload>({
    env,
    fetchImpl,
    parseSuccess: (payload) =>
      typeof payload === "object" && payload !== null && "ok" in payload && payload.ok === true && "service" in payload && payload.service === "nest"
        ? { ok: true, service: "nest" }
        : null,
    path: "/internal/health",
    reporter,
    requestId,
    route: HEALTH_ROUTE,
  })

  if ("ok" in result && result.ok) return { ...result, source: "nest" }

  return result
}

export const getNestGatewayTodayClasses = async ({
  env = process.env,
  fetchImpl = fetch,
  requestId,
  reporter = defaultNestGatewayFallbackReporter,
}: NestGatewayHealthOptions = {}): Promise<NestGatewayTodayClassesResult> => {
  return executeNestGatewayRequest<CheckinTodayClassesResponse>({
    env,
    fetchImpl,
    parseSuccess: parseCheckinTodayClassesResponse,
    path: "/internal/checkin/today-classes",
    reporter,
    requestId,
    route: TODAY_CLASSES_ROUTE,
  })
}

export const getNestGatewayQrDecision = async ({
  env = process.env,
  fetchImpl = fetch,
  payload,
  requestId,
  reporter = defaultNestGatewayFallbackReporter,
}: NestGatewayHealthOptions & {
  payload: CheckinQrDecisionGatewayRequest
}): Promise<NestGatewayQrDecisionResult> => {
  return executeNestGatewayRequest({
    env,
    fetchImpl,
    body: payload,
    method: "POST",
    parseSuccess: (responsePayload) => parseCheckinQrDecisionGatewayResponse(responsePayload, payload),
    path: "/internal/checkin/qr/decision",
    reporter,
    requestId,
    route: QR_DECISION_ROUTE,
  })
}
