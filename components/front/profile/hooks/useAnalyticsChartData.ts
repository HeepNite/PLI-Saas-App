import React from "react"
import type { MetricKey } from "../profile-types"
import { analyticsMetricConfig, analyticsMonths } from "../profile-constants"

type HoverPoint = { label: string; value: number; x: number; y: number; idx: number } | null

export type AnalyticsChartData = {
  activeMetric: MetricKey
  setActiveMetric: React.Dispatch<React.SetStateAction<MetricKey>>
  hoverPoint: HoverPoint
  setHoverPoint: React.Dispatch<React.SetStateAction<HoverPoint>>
  series: { label: string; color: string; values: number[] }
  chartWidth: number
  chartHeight: number
  paddingX: number
  paddingY: number
  gridCount: number
  points: Array<{ value: number; label: string; x: number; y: number; idx: number }>
  targetValues: number[]
  targetPoints: Array<{ value: number; label: string; x: number; y: number }>
  pathD: string
  targetPathD: string
  yTicks: Array<{ y: number; value: number }>
  pieSegments: Array<{ label: string; value: number; color: string }>
  pieGradient: string
}

export function useAnalyticsChartData(monthlyAttendance: Array<{ label: string; value: number }>): AnalyticsChartData {
  const [activeMetric, setActiveMetric] = React.useState<MetricKey>("attendance")
  const [hoverPoint, setHoverPoint] = React.useState<HoverPoint>(null)

  const chartLabels = React.useMemo(() => {
    if (!monthlyAttendance.length) return analyticsMonths
    return monthlyAttendance.map((item) => item.label.split(" ")[0]).slice(0, 4)
  }, [monthlyAttendance])
  const attendanceSeriesValues = React.useMemo(() => {
    if (!monthlyAttendance.length) return analyticsMetricConfig.attendance.values
    return monthlyAttendance.map((item) => item.value).slice(0, 4)
  }, [monthlyAttendance])
  const activeSeriesValues = React.useMemo(() => {
    if (activeMetric === "attendance") return attendanceSeriesValues
    return analyticsMetricConfig[activeMetric].values
  }, [activeMetric, attendanceSeriesValues])
  const series = {
    ...analyticsMetricConfig[activeMetric],
    values: activeSeriesValues.length > 1 ? activeSeriesValues : [...activeSeriesValues, ...analyticsMetricConfig[activeMetric].values].slice(0, 4),
  }
  const maxValue = Math.max(...series.values, 6)
  const chartWidth = 520
  const chartHeight = 170
  const paddingX = 20
  const paddingY = 10
  const gridCount = 5
  const stepX = (chartWidth - paddingX * 2) / (series.values.length - 1)
  const toPoint = (value: number, index: number) => {
    const x = paddingX + index * stepX
    const y = chartHeight - paddingY - (value / maxValue) * (chartHeight - paddingY * 2)
    return { x, y }
  }
  const points = series.values.map((value, index) => ({
    value,
    label: chartLabels[index] || analyticsMonths[index],
    ...toPoint(value, index),
    idx: index,
  }))
  const pathD = points
    .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
  const targetValues = series.values.map((value, idx) => {
    const prev = series.values[idx - 1] ?? value
    const next = series.values[idx + 1] ?? value
    return Math.max(1, Math.round((value + prev + next) / 3))
  })
  const targetPoints = targetValues.map((value, index) => ({
    value,
    label: chartLabels[index] || analyticsMonths[index],
    ...toPoint(value, index),
  }))
  const targetPathD = targetPoints.map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
  const yTicks = Array.from({ length: gridCount }).map((_, idx) => {
    const ratio = idx / (gridCount - 1)
    const y = paddingY + ratio * (chartHeight - paddingY * 2)
    const value = Math.round(maxValue - ratio * maxValue)
    return { y, value }
  })

  const pieSegments = [
    { label: "Attendance", value: 42, color: "var(--brand,#b61616)" },
    { label: "Progress", value: 34, color: "#ef6b6b" },
    { label: "Rhythm", value: 24, color: "#f59e0b" },
  ]
  const pieStops = pieSegments.reduce<{ value: number; color: string }[]>((acc, segment) => {
    const total = acc.reduce((sum, s) => sum + s.value, 0)
    acc.push({ value: total + segment.value, color: segment.color })
    return acc
  }, [])
  const pieGradient = pieStops
    .map((stop, idx) => {
      const start = idx === 0 ? 0 : pieStops[idx - 1].value
      return `${stop.color} ${start}% ${stop.value}%`
    })
    .join(", ")

  return {
    activeMetric,
    setActiveMetric,
    hoverPoint,
    setHoverPoint,
    series,
    chartWidth,
    chartHeight,
    paddingX,
    paddingY,
    gridCount,
    points,
    targetValues,
    targetPoints,
    pathD,
    targetPathD,
    yTicks,
    pieSegments,
    pieGradient,
  }
}
