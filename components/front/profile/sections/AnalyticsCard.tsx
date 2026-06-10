import React from "react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import { analyticsMetricConfig } from "../profile-constants"
import type { ActivityStats, MetricKey } from "../profile-types"

type HoverPoint = { label: string; value: number; x: number; y: number; idx: number } | null

type AnalyticsCardProps = {
  activeMetric: MetricKey
  activityStats: ActivityStats
  chartWidth: number
  chartHeight: number
  paddingX: number
  paddingY: number
  points: Array<{ value: number; label: string; x: number; y: number; idx: number }>
  targetValues: number[]
  targetPoints: Array<{ value: number; label: string; x: number; y: number }>
  pathD: string
  targetPathD: string
  yTicks: Array<{ y: number; value: number }>
  pieSegments: Array<{ label: string; value: number; color: string }>
  pieGradient: string
  hoverPoint: HoverPoint
  onMetricChange: (metric: MetricKey) => void
  onHoverPointChange: (point: HoverPoint) => void
}

export function AnalyticsCard({
  activeMetric,
  activityStats,
  chartWidth,
  chartHeight,
  paddingX,
  paddingY,
  points,
  targetValues,
  targetPoints,
  pathD,
  targetPathD,
  yTicks,
  pieSegments,
  pieGradient,
  hoverPoint,
  onMetricChange,
  onHoverPointChange,
}: AnalyticsCardProps) {
  return (
    <GlassyCard className="order-8 p-4">
      <div className="relative overflow-visible rounded-3xl border border-white/10 bg-gradient-to-br from-[#120b14] via-[#0f0b12] to-[#0b0b0f] p-5 shadow-[0_30px_120px_-60px_rgba(182,22,22,0.8)]">
        <div className="pointer-events-none absolute -left-24 -top-20 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(182,22,22,0.45),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-6 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(239,107,107,0.4),transparent_70%)] blur-3xl" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Analytics</p>
            <p className="mt-2 text-sm text-white/70">Overall student progress.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">Filters</span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">This month</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["attendance", "progress", "rhythm"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onMetricChange(key)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                activeMetric === key
                  ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.22)] text-white shadow-[0_12px_30px_-16px_rgba(182,22,22,0.8)]"
                  : "border-white/10 text-white/70 hover:border-white/30"
              }`}
            >
              {analyticsMetricConfig[key].label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[0.65fr_2.75fr_0.85fr] gap-4 items-stretch">
          <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-col lg:space-y-3 lg:gap-0 lg:h-full">
            <div className="relative min-h-[148px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-[#0b0b0f]/80 px-5 py-4 flex-1 flex flex-col justify-between text-center">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Total classes</p>
              <p className="mt-2 text-[52px] font-semibold leading-none tracking-tight text-white">{activityStats.classesTaken}</p>
              <p className="mt-2 text-[11px] text-white/50">+12% vs previous month</p>
            </div>
            <div className="min-h-[148px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-[#0b0b0f]/80 px-5 py-4 flex-1 flex flex-col justify-between text-center">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Weekly average</p>
              <p className="mt-2 text-[52px] font-semibold leading-none tracking-tight text-white">{activityStats.weeklyAverage}</p>
              <p className="mt-2 text-[11px] text-white/50">Streak: {activityStats.streakWeeks} weeks</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 h-full flex flex-col">
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span>{analyticsMetricConfig[activeMetric].label}</span>
              <span>Last 4 months</span>
            </div>
            <div className="mt-2 flex flex-col overflow-visible">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#141017] via-[#0d0b12] to-[#09090d] px-3 pb-2 pt-3 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]">
                <div className="pointer-events-none absolute right-4 top-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/70">
                  Estimated progress
                </div>
                <div className="grid grid-cols-[40px_1fr] gap-2">
                  <div className="relative h-[185px] text-[10px] text-white/40">
                    {yTicks.map((tick) => (
                      <span
                        key={`y-label-${tick.value}`}
                        className="absolute right-1"
                        style={{ top: `${(tick.y / chartHeight) * 100}%`, transform: "translateY(-50%)" }}
                      >
                        {tick.value}
                      </span>
                    ))}
                  </div>
                  <div className="relative h-[185px]">
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
                      <defs>
                        <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="rgba(182,22,22,0.25)" />
                          <stop offset="50%" stopColor="rgba(182,22,22,0.95)" />
                          <stop offset="100%" stopColor="rgba(182,22,22,0.4)" />
                        </linearGradient>
                        <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(182,22,22,0.5)" />
                          <stop offset="55%" stopColor="rgba(182,22,22,0.2)" />
                          <stop offset="100%" stopColor="rgba(11,11,15,0)" />
                        </linearGradient>
                        <linearGradient id="targetGlow" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="rgba(245,158,11,0.4)" />
                          <stop offset="100%" stopColor="rgba(245,158,11,0.95)" />
                        </linearGradient>
                      </defs>
                      {yTicks.map((tick) => (
                        <line
                          key={`grid-${tick.value}`}
                          x1={paddingX}
                          x2={chartWidth - paddingX}
                          y1={tick.y}
                          y2={tick.y}
                          stroke="rgba(255,255,255,0.08)"
                          strokeDasharray="4 6"
                        />
                      ))}
                      <path d={`${pathD} L ${chartWidth - paddingX} ${chartHeight - paddingY} L ${paddingX} ${chartHeight - paddingY} Z`} fill="url(#areaGlow)" />
                      <path d={pathD} fill="none" stroke="url(#lineGlow)" strokeWidth="3" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 8px rgba(182,22,22,0.6))" }} />
                      <path d={targetPathD} fill="none" stroke="url(#targetGlow)" strokeWidth="2" strokeLinecap="round" />
                      {targetPoints.map((point, idx) => (
                        <circle
                          key={`target-${point.label}`}
                          cx={point.x}
                          cy={point.y}
                          r={hoverPoint?.idx === idx ? 4.5 : 3}
                          fill="rgba(245,158,11,0.95)"
                          stroke="rgba(255,255,255,0.6)"
                          strokeWidth="1"
                        />
                      ))}
                      {hoverPoint && (
                        <line
                          x1={hoverPoint.x}
                          x2={hoverPoint.x}
                          y1={paddingY}
                          y2={chartHeight - paddingY}
                          stroke="rgba(255,255,255,0.35)"
                          strokeDasharray="4 6"
                        />
                      )}
                      {points.map((point, idx) => {
                        const isActive = hoverPoint?.idx === idx
                        return (
                          <g
                            key={`${point.label}-${point.value}`}
                            onMouseEnter={() => onHoverPointChange({ label: point.label, value: point.value, x: point.x, y: point.y, idx: point.idx })}
                            onMouseLeave={() => onHoverPointChange(null)}
                          >
                            <circle cx={point.x} cy={point.y} r={isActive ? 18 : 12} fill="rgba(182,22,22,0.2)" />
                            <circle cx={point.x} cy={point.y} r={isActive ? 7 : 6} fill="#fff" stroke="rgba(182,22,22,0.85)" strokeWidth="2" />
                          </g>
                        )
                      })}
                    </svg>
                    {hoverPoint && (
                      <div
                        className="pointer-events-none absolute z-10 min-w-[170px] rounded-2xl border border-white/10 bg-[#151018] px-4 py-3 text-[11px] text-white/80 shadow-[0_25px_55px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md"
                        style={{
                          left: `clamp(12%, ${(hoverPoint.x / chartWidth) * 100}%, 88%)`,
                          top: `clamp(18%, ${(hoverPoint.y / chartHeight) * 100}%, 78%)`,
                          transform: "translate(-50%, -40%)",
                        }}
                      >
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{hoverPoint.label} 2026</p>
                        <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-white/50">{analyticsMetricConfig[activeMetric].label}</p>
                            <p className="text-sm font-semibold text-white">{hoverPoint.value}</p>
                          </div>
                          <div>
                            <p className="text-white/50">Goal</p>
                            <p className="text-sm font-semibold text-white">{targetValues[hoverPoint.idx]}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-[10px] text-white/50">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[var(--brand,#b61616)]" />
                            Current
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                            Target
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-1 relative h-3 text-[11px] text-white/50 overflow-visible ml-[40px]">
                {points.map((point) => (
                  <span
                    key={`label-${point.label}`}
                    className="absolute"
                    style={{
                      left: `${(point.x / chartWidth) * 100}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {point.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-row gap-3 lg:flex-col lg:space-y-3 lg:gap-0 lg:h-full">
            <div className="relative min-h-[148px] overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex-1 flex flex-col">
              <div className="flex items-center gap-2 text-[11px] text-white/60">
                <span className="h-2 w-2 rounded-full bg-[var(--brand,#b61616)]" />
                Distribution
              </div>
              <div className="mt-3 flex flex-1 flex-col">
                <div className="flex flex-1 items-center justify-center">
                  <div className="relative h-32 w-32">
                    <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${pieGradient})` }} />
                    <div className="absolute inset-[10px] rounded-full bg-[#0b0b0f] border border-white/10 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-[10px] text-white/60">Total</p>
                        <p className="text-lg font-semibold text-white">100%</p>
                      </div>
                    </div>
                    <div className="absolute -bottom-4 left-1/2 h-6 w-16 -translate-x-1/2 rounded-full bg-[var(--brand,#b61616)]/30 blur-xl" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 order-first lg:order-none lg:flex-none">
              <div className="space-y-2 text-[11px] text-white/70">
                {pieSegments.map((seg) => (
                  <div key={seg.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
                      <span>{seg.label}</span>
                    </div>
                    <span className="text-white/50">{seg.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassyCard>
  )
}
