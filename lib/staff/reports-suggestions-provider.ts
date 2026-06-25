import { asObject } from "@/lib/shared"

type ReportsObjectiveFilter =
  | "all"
  | "monday_sales"
  | "class_quality"
  | "retention"
  | "package_mix"
  | "pending_recovery"

type ReportsSuggestionPriority = "High" | "Medium" | "Low"

export type ReportsSuggestionPayload = {
  id: string
  objective: Exclude<ReportsObjectiveFilter, "all">
  title: string
  priority: ReportsSuggestionPriority
  insight: string
  proposal: string
  actions: string[]
  aiBrief: string
}

export type ReportsSuggestionsRequest = {
  objectiveFilter: ReportsObjectiveFilter
  metrics: Record<string, unknown>
  suggestions: ReportsSuggestionPayload[]
}

export type ReportsSuggestionsResult = {
  provider: "mock" | "custom-http"
  suggestions: ReportsSuggestionPayload[]
  usedFallback: boolean
  warning: string | null
}

const VALID_OBJECTIVES = new Set([
  "monday_sales",
  "class_quality",
  "retention",
  "package_mix",
  "pending_recovery",
] as const)

const VALID_PRIORITIES = new Set(["High", "Medium", "Low"] as const)

const asText = (value: unknown, max = 600) => (typeof value === "string" ? value.trim().slice(0, max) : "")

const normalizeObjective = (value: unknown): ReportsSuggestionPayload["objective"] | null => {
  if (typeof value !== "string") return null
  const objective = value.trim().toLowerCase()
  return VALID_OBJECTIVES.has(objective as ReportsSuggestionPayload["objective"])
    ? (objective as ReportsSuggestionPayload["objective"])
    : null
}

const normalizePriority = (value: unknown): ReportsSuggestionPriority => {
  if (typeof value !== "string") return "Medium"
  const normalized = value.trim()
  return VALID_PRIORITIES.has(normalized as ReportsSuggestionPriority) ? (normalized as ReportsSuggestionPriority) : "Medium"
}

const normalizeActions = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asText(item, 260))
    .filter(Boolean)
    .slice(0, 8)
}

const normalizeSuggestion = (value: unknown, index: number): ReportsSuggestionPayload | null => {
  const source = asObject(value)
  const objective = normalizeObjective(source.objective)
  if (!objective) return null

  const title = asText(source.title, 140)
  const insight = asText(source.insight, 420)
  const proposal = asText(source.proposal, 420)
  const aiBrief = asText(source.aiBrief || source.ai_brief, 2_000)
  const actions = normalizeActions(source.actions)
  if (!title || !insight || !proposal || !aiBrief || actions.length === 0) return null

  const id = asText(source.id, 90) || `ai-suggestion-${index + 1}`
  return {
    id,
    objective,
    title,
    priority: normalizePriority(source.priority),
    insight,
    proposal,
    actions,
    aiBrief,
  }
}

const normalizeSuggestions = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => normalizeSuggestion(item, index))
    .filter((item): item is ReportsSuggestionPayload => Boolean(item))
    .slice(0, 12)
}

const normalizeProvider = (value: unknown): "mock" | "custom-http" => {
  if (typeof value !== "string") return "mock"
  return value.trim().toLowerCase() === "custom-http" ? "custom-http" : "mock"
}

const buildRequestPayload = (request: ReportsSuggestionsRequest) => ({
  objectiveFilter: request.objectiveFilter,
  metrics: request.metrics,
  suggestions: request.suggestions,
})

const requestCustomHttpSuggestions = async (
  endpoint: string,
  token: string | null,
  request: ReportsSuggestionsRequest
) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(buildRequestPayload(request)),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`AI provider returned status ${response.status}`)
    }

    const payload = asObject(await response.json())
    const suggestions = normalizeSuggestions(payload.suggestions)
    const warning = asText(payload.warning, 400) || null
    return { suggestions, warning }
  } finally {
    clearTimeout(timeout)
  }
}

export const resolveReportsSuggestionsWithProvider = async (
  request: ReportsSuggestionsRequest
): Promise<ReportsSuggestionsResult> => {
  const fallbackSuggestions = normalizeSuggestions(request.suggestions)
  const provider = normalizeProvider(process.env.AI_REPORTS_PROVIDER)
  const endpoint = asText(process.env.AI_REPORTS_AGENT_URL, 2_000)
  const token = asText(process.env.AI_REPORTS_AGENT_TOKEN, 2_000) || null

  if (provider === "custom-http" && endpoint) {
    try {
      const result = await requestCustomHttpSuggestions(endpoint, token, request)
      if (result.suggestions.length > 0) {
        return {
          provider: "custom-http",
          suggestions: result.suggestions,
          usedFallback: false,
          warning: result.warning,
        }
      }
      return {
        provider: "custom-http",
        suggestions: fallbackSuggestions,
        usedFallback: true,
        warning: result.warning || "AI provider returned no suggestions. Local strategy suggestions are shown.",
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error"
      return {
        provider: "custom-http",
        suggestions: fallbackSuggestions,
        usedFallback: true,
        warning: `AI provider unavailable (${message}). Local strategy suggestions are shown.`,
      }
    }
  }

  return {
    provider: "mock",
    suggestions: fallbackSuggestions,
    usedFallback: false,
    warning: null,
  }
}

