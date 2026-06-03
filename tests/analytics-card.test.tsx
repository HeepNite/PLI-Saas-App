import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { AnalyticsCard } from "@/components/front/profile/sections/AnalyticsCard"

describe("AnalyticsCard", () => {
  it("renders analytics header, metric tabs and distribution summary", () => {
    const html = renderToStaticMarkup(
      <AnalyticsCard
        activeMetric="attendance"
        activityStats={{ classesTaken: 12, weeklyAverage: 3, streakWeeks: 4, recurringLabel: null, lastClassLabel: null }}
        chartWidth={520}
        chartHeight={170}
        paddingX={20}
        paddingY={10}
        points={[
          { value: 5, label: "Oct", x: 20, y: 120, idx: 0 },
          { value: 6, label: "Nov", x: 180, y: 100, idx: 1 },
        ]}
        targetValues={[5, 6]}
        targetPoints={[
          { value: 5, label: "Oct", x: 20, y: 120 },
          { value: 6, label: "Nov", x: 180, y: 100 },
        ]}
        pathD="M 20 120 L 180 100"
        targetPathD="M 20 120 L 180 100"
        yTicks={[{ y: 10, value: 6 }, { y: 160, value: 0 }]}
        pieSegments={[
          { label: "Attendance", value: 42, color: "var(--brand,#b61616)" },
          { label: "Progress", value: 34, color: "#ef6b6b" },
          { label: "Rhythm", value: 24, color: "#f59e0b" },
        ]}
        pieGradient="var(--brand,#b61616) 0% 42%, #ef6b6b 42% 76%, #f59e0b 76% 100%"
        hoverPoint={null}
        onMetricChange={vi.fn()}
        onHoverPointChange={vi.fn()}
      />
    )

    expect(html).toContain("Overall student progress.")
    expect(html).toContain("Attendance")
    expect(html).toContain("Progress")
    expect(html).toContain("Rhythm")
    expect(html).toContain("Distribution")
    expect(html).toContain("Total")
  })

  it("renders hover tooltip details when a hover point is present", () => {
    const html = renderToStaticMarkup(
      <AnalyticsCard
        activeMetric="progress"
        activityStats={{ classesTaken: 20, weeklyAverage: 5, streakWeeks: 6, recurringLabel: null, lastClassLabel: null }}
        chartWidth={520}
        chartHeight={170}
        paddingX={20}
        paddingY={10}
        points={[
          { value: 2, label: "Oct", x: 20, y: 140, idx: 0 },
          { value: 3, label: "Nov", x: 180, y: 110, idx: 1 },
        ]}
        targetValues={[2, 4]}
        targetPoints={[
          { value: 2, label: "Oct", x: 20, y: 140 },
          { value: 4, label: "Nov", x: 180, y: 90 },
        ]}
        pathD="M 20 140 L 180 110"
        targetPathD="M 20 140 L 180 90"
        yTicks={[{ y: 10, value: 4 }, { y: 160, value: 0 }]}
        pieSegments={[
          { label: "Attendance", value: 42, color: "var(--brand,#b61616)" },
          { label: "Progress", value: 34, color: "#ef6b6b" },
          { label: "Rhythm", value: 24, color: "#f59e0b" },
        ]}
        pieGradient="var(--brand,#b61616) 0% 42%, #ef6b6b 42% 76%, #f59e0b 76% 100%"
        hoverPoint={{ label: "Nov", value: 3, x: 180, y: 110, idx: 1 }}
        onMetricChange={vi.fn()}
        onHoverPointChange={vi.fn()}
      />
    )

    expect(html).toContain("Nov 2026")
    expect(html).toContain("Goal")
    expect(html).toContain("Current")
    expect(html).toContain("Target")
  })
})
