import { describe, expect, it } from "vitest"
import {
  doUtcIntervalsOverlap,
  doUtcIntervalsOverlapWithBuffer,
} from "@/lib/class-schedule"

describe("doUtcIntervalsOverlapWithBuffer", () => {
  const A_START = new Date("2026-06-01T10:00:00.000Z")
  const A_END = new Date("2026-06-01T11:00:00.000Z")

  it("adjacent events with 0 buffer → conflict (boundary-inclusive)", () => {
    const B_START = new Date("2026-06-01T11:00:00.000Z")
    const B_END = new Date("2026-06-01T12:00:00.000Z")
    // Buffer variant uses boundary-inclusive: touching intervals = conflict
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, 0)).toBe(true)
  })

  it("adjacent events with 15min buffer → CONFLICT", () => {
    const B_START = new Date("2026-06-01T11:00:00.000Z")
    const B_END = new Date("2026-06-01T12:00:00.000Z")
    const buffer15 = 15 * 60 * 1000
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, buffer15)).toBe(true)
  })

  it("14min gap + 15min buffer → CONFLICT", () => {
    const B_START = new Date("2026-06-01T11:14:00.000Z")
    const B_END = new Date("2026-06-01T12:00:00.000Z")
    const buffer15 = 15 * 60 * 1000
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, buffer15)).toBe(true)
  })

  it("16min gap + 15min buffer → NO conflict", () => {
    const B_START = new Date("2026-06-01T11:16:00.000Z")
    const B_END = new Date("2026-06-01T12:00:00.000Z")
    const buffer15 = 15 * 60 * 1000
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, buffer15)).toBe(false)
  })

  it("15min gap + 15min buffer → CONFLICT (boundary: gap equals buffer)", () => {
    const B_START = new Date("2026-06-01T11:15:00.000Z")
    const B_END = new Date("2026-06-01T12:00:00.000Z")
    const buffer15 = 15 * 60 * 1000
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, buffer15)).toBe(true)
  })

  it("overlapping events with any buffer → CONFLICT", () => {
    const B_START = new Date("2026-06-01T10:30:00.000Z")
    const B_END = new Date("2026-06-01T11:30:00.000Z")
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, 0)).toBe(true)
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, 15 * 60 * 1000)).toBe(true)
  })

  it("same event → CONFLICT", () => {
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, A_START, A_END, 0)).toBe(true)
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, A_START, A_END, 15 * 60 * 1000)).toBe(true)
  })

  it("buffer = 0 → overlapping events match doUtcIntervalsOverlap", () => {
    const B_START = new Date("2026-06-01T10:30:00.000Z")
    const B_END = new Date("2026-06-01T11:30:00.000Z")
    const withBuffer = doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, 0)
    const withoutBuffer = doUtcIntervalsOverlap(A_START, A_END, B_START, B_END)
    expect(withBuffer).toBe(withoutBuffer)
    expect(withBuffer).toBe(true)
  })

  it("buffer = 0 with adjacent events → conflict (boundary-inclusive)", () => {
    const B_START = new Date("2026-06-01T11:00:00.000Z")
    const B_END = new Date("2026-06-01T12:00:00.000Z")
    // doUtcIntervalsOverlap allows adjacent (strict), but buffer variant uses boundary-inclusive
    expect(doUtcIntervalsOverlap(A_START, A_END, B_START, B_END)).toBe(false)
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, 0)).toBe(true)
  })

  it("buffer = 0 with overlapping events → same as doUtcIntervalsOverlap", () => {
    const B_START = new Date("2026-06-01T10:30:00.000Z")
    const B_END = new Date("2026-06-01T11:30:00.000Z")
    const withBuffer = doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, 0)
    const withoutBuffer = doUtcIntervalsOverlap(A_START, A_END, B_START, B_END)
    expect(withBuffer).toBe(withoutBuffer)
    expect(withBuffer).toBe(true)
  })

  it("invalid dates → false", () => {
    const invalid = new Date("invalid")
    const valid = new Date("2026-06-01T10:00:00.000Z")
    const validEnd = new Date("2026-06-01T11:00:00.000Z")
    expect(doUtcIntervalsOverlapWithBuffer(invalid, validEnd, valid, validEnd, 0)).toBe(false)
    expect(doUtcIntervalsOverlapWithBuffer(valid, validEnd, invalid, validEnd, 0)).toBe(false)
  })

  it("symmetric: order of intervals does not matter", () => {
    const B_START = new Date("2026-06-01T11:00:00.000Z")
    const B_END = new Date("2026-06-01T12:00:00.000Z")
    const buffer15 = 15 * 60 * 1000
    const forward = doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, buffer15)
    const reverse = doUtcIntervalsOverlapWithBuffer(B_START, B_END, A_START, A_END, buffer15)
    expect(forward).toBe(reverse)
    expect(forward).toBe(true)
  })

  it("B before A with buffer → CONFLICT", () => {
    const B_START = new Date("2026-06-01T09:00:00.000Z")
    const B_END = new Date("2026-06-01T10:00:00.000Z")
    const buffer15 = 15 * 60 * 1000
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, buffer15)).toBe(true)
  })

  it("B before A with sufficient gap → NO conflict", () => {
    const B_START = new Date("2026-06-01T09:00:00.000Z")
    const B_END = new Date("2026-06-01T09:44:00.000Z")
    const buffer15 = 15 * 60 * 1000
    expect(doUtcIntervalsOverlapWithBuffer(A_START, A_END, B_START, B_END, buffer15)).toBe(false)
  })
})
