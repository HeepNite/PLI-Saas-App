const DEFAULT_TIMEOUT_MS = 1_500

const ROUTE_FLAG_ENV_NAMES = {
  "internal-health": "NEST_GATEWAY_ROUTE_INTERNAL_HEALTH_ENABLED",
  "today-classes": "NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED",
  "qr-decision": "NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED",
} as const

const asEnabledFlag = (value: string | undefined) => value?.trim().toLowerCase() === "true"

const normalizeBaseUrl = (value: string | undefined) => value?.trim().replace(/\/+$/, "") || ""

const asTimeoutMs = (value: string | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS
}

export type NestGatewayConfig = {
  enabled: boolean
  baseUrl: string
  routeFlags: Record<NestGatewayRoute, boolean>
  sharedSecret: string
  timeoutMs: number
}

export type NestGatewayRoute = keyof typeof ROUTE_FLAG_ENV_NAMES

const DEFAULT_ROUTE_FLAGS: Record<NestGatewayRoute, boolean> = {
  "internal-health": true,
  "today-classes": false,
  "qr-decision": false,
}

const resolveRouteFlags = (env: NodeJS.ProcessEnv, enabled: boolean): Record<NestGatewayRoute, boolean> => {
  const routeFlags = {} as Record<NestGatewayRoute, boolean>

  for (const route of Object.keys(ROUTE_FLAG_ENV_NAMES) as NestGatewayRoute[]) {
    const envName = ROUTE_FLAG_ENV_NAMES[route]
    const explicitFlag = env[envName]
    const routeEnabled = explicitFlag === undefined ? DEFAULT_ROUTE_FLAGS[route] : asEnabledFlag(explicitFlag)
    routeFlags[route] = enabled && routeEnabled
  }

  return routeFlags
}

export const getNestGatewayConfig = (env: NodeJS.ProcessEnv = process.env): NestGatewayConfig => {
  const enabled = asEnabledFlag(env.NEST_GATEWAY_ENABLED)

  return {
    enabled,
    baseUrl: normalizeBaseUrl(env.NEST_BACKEND_INTERNAL_URL),
    routeFlags: resolveRouteFlags(env, enabled),
    sharedSecret: env.NEST_GATEWAY_SHARED_SECRET?.trim() || "",
    timeoutMs: asTimeoutMs(env.NEST_GATEWAY_TIMEOUT_MS),
  }
}

export const isNestGatewayRouteEnabled = (config: NestGatewayConfig, route: NestGatewayRoute) =>
  config.routeFlags[route]
