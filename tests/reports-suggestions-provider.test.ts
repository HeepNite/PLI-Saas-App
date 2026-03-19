import { afterEach, describe, expect, it, vi } from "vitest"
import { resolveReportsSuggestionsWithProvider, type ReportsSuggestionsRequest } from "@/lib/staff/reports-suggestions-provider"

const buildRequest = (): ReportsSuggestionsRequest => ({
  objectiveFilter: "all",
  metrics: {
    totalPaidSales: 10,
    pendingStripeSales: 2,
  },
  suggestions: [
    {
      id: "base-1",
      objective: "retention",
      title: "Raise retention",
      priority: "High",
      insight: "Week-1 retention is low.",
      proposal: "Create a follow-up cadence in 72 hours.",
      actions: ["Send first follow-up", "Offer second-class coupon"],
      aiBrief: "Build a retention plan for week-1 drop-off.",
    },
  ],
})

describe("reports suggestions provider", () => {
  const envBackup = {
    AI_REPORTS_PROVIDER: process.env.AI_REPORTS_PROVIDER,
    AI_REPORTS_AGENT_URL: process.env.AI_REPORTS_AGENT_URL,
    AI_REPORTS_AGENT_TOKEN: process.env.AI_REPORTS_AGENT_TOKEN,
  }

  afterEach(() => {
    process.env.AI_REPORTS_PROVIDER = envBackup.AI_REPORTS_PROVIDER
    process.env.AI_REPORTS_AGENT_URL = envBackup.AI_REPORTS_AGENT_URL
    process.env.AI_REPORTS_AGENT_TOKEN = envBackup.AI_REPORTS_AGENT_TOKEN
    vi.restoreAllMocks()
  })

  it("returns local suggestions in mock mode", async () => {
    process.env.AI_REPORTS_PROVIDER = "mock"
    delete process.env.AI_REPORTS_AGENT_URL
    const result = await resolveReportsSuggestionsWithProvider(buildRequest())
    expect(result.provider).toBe("mock")
    expect(result.usedFallback).toBe(false)
    expect(result.warning).toBeNull()
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0].id).toBe("base-1")
  })

  it("calls external provider when custom-http is configured", async () => {
    process.env.AI_REPORTS_PROVIDER = "custom-http"
    process.env.AI_REPORTS_AGENT_URL = "https://agent.example.com/reports/suggestions"
    process.env.AI_REPORTS_AGENT_TOKEN = "token_123"
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              id: "remote-1",
              objective: "monday_sales",
              title: "Monday boost",
              priority: "Medium",
              insight: "Monday has 30% less demand.",
              proposal: "Run Monday campaign.",
              actions: ["Publish Monday promo", "Send segmented reminder"],
              aiBrief: "Plan Monday campaign.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const result = await resolveReportsSuggestionsWithProvider(buildRequest())
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(result.provider).toBe("custom-http")
    expect(result.usedFallback).toBe(false)
    expect(result.warning).toBeNull()
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0].id).toBe("remote-1")
  })

  it("falls back to local suggestions if external provider fails", async () => {
    process.env.AI_REPORTS_PROVIDER = "custom-http"
    process.env.AI_REPORTS_AGENT_URL = "https://agent.example.com/reports/suggestions"
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))

    const result = await resolveReportsSuggestionsWithProvider(buildRequest())
    expect(result.provider).toBe("custom-http")
    expect(result.usedFallback).toBe(true)
    expect(result.warning).toContain("AI provider unavailable")
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0].id).toBe("base-1")
  })
})

