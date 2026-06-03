import type { SelfProfileMetrics } from "./staffAdminTypes"

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const computeSelfPerformanceScore = (metrics: SelfProfileMetrics) => {
  const ratingBase = metrics.performanceRating ? clamp((metrics.performanceRating / 5) * 70, 0, 70) : 35
  const reviewBase = metrics.performanceReviewsCount
    ? clamp(metrics.performanceReviewsCount * 5, 0, 20)
    : 6
  const cadencePenalty =
    typeof metrics.performanceReviewCycleDays === "number" && metrics.performanceReviewCycleDays > 45
      ? clamp((metrics.performanceReviewCycleDays - 45) * 0.35, 0, 12)
      : 0
  return clamp(Math.round(ratingBase + reviewBase - cadencePenalty), 0, 100)
}

export const buildSelfRecommendations = (metrics: SelfProfileMetrics) => {
  const tips: string[] = []
  if (typeof metrics.performanceRating !== "number") {
    tips.push("Request your first performance review to establish a baseline score.")
  } else if (metrics.performanceRating < 4.2) {
    tips.push("Improve class delivery consistency to raise rating above 4.2.")
  } else {
    tips.push("Keep teaching consistency high and document repeatable class structure.")
  }
  if (!metrics.performanceReviewCycleDays || metrics.performanceReviewCycleDays > 45) {
    tips.push("Ask for a shorter review cycle (every 30-45 days) to get faster feedback loops.")
  }
  if (metrics.payrollStatus === "pending") {
    tips.push("Track pending payroll status and confirm payout date with management.")
  }
  if (tips.length < 3) {
    tips.push("Log schedule or vacation requests early to avoid last-minute conflicts.")
  }
  return tips.slice(0, 3)
}
