// Keep input normalization outside the render component so tests can target the
// behavior without widening the component module's public surface.
export function normalizeRecurrenceIntervalInput(value: string): number {
  return Math.max(1, Math.min(12, Number(value) || 1))
}
