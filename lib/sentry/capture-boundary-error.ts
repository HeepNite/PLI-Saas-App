"use client"

import * as Sentry from "@sentry/nextjs"

const capturedErrors = new WeakSet<Error>()

export function captureBoundaryError(error: Error, area: string) {
  if (capturedErrors.has(error)) {
    return false
  }

  capturedErrors.add(error)
  Sentry.captureException(error, { tags: { area } })

  return true
}
