type RuntimeEnvironment = Record<string, string | undefined>

export type SentryRuntimeConfig = {
  release: string | undefined
  environment: "development" | "preview" | "production" | "staging"
}

const acceptedEnvironments = new Set<SentryRuntimeConfig["environment"]>([
  "development",
  "preview",
  "production",
  "staging",
])

function readEnvironmentValue(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()

  return normalized && acceptedEnvironments.has(normalized as SentryRuntimeConfig["environment"])
    ? (normalized as SentryRuntimeConfig["environment"])
    : undefined
}

function readRelease(value: string | undefined) {
  const release = value?.trim()

  return release || undefined
}

export function resolveSentryRuntimeConfig(env: RuntimeEnvironment): SentryRuntimeConfig {
  const release = readRelease(env.SENTRY_RELEASE) ?? readRelease(env.VERCEL_GIT_COMMIT_SHA)
  const environment =
    readEnvironmentValue(env.SENTRY_ENVIRONMENT) ??
    readEnvironmentValue(env.VERCEL_ENV) ??
    readEnvironmentValue(env.NODE_ENV) ??
    "development"

  return { release, environment }
}
