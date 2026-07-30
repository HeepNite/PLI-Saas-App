import { Children, isValidElement, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import SignInPage from "@/app/(auth)/sign-in/page"
import { resolveCheckInActiveContext, resolveCheckInBootstrapContextPayload } from "@/lib/checkin/checkin-bootstrap-context"
import { resolveSafeQrRedirect } from "@/lib/checkin/qr-auth-resume"

const { signInMock } = vi.hoisted(() => ({
  signInMock: vi.fn(() => null),
}))

vi.mock("@clerk/nextjs", () => ({
  SignIn: signInMock,
}))

function findElementProps(node: ReactNode, targetType: unknown): Record<string, unknown> | null {
  if (!isValidElement(node)) return null
  const props = node.props as { children?: ReactNode }
  if (node.type === targetType) return node.props as Record<string, unknown>

  for (const child of Children.toArray(props.children)) {
    const match = findElementProps(child, targetType)
    if (match) return match
  }

  return null
}

async function getSignInProps(redirectUrl?: string | string[]) {
  const page = await SignInPage({
    searchParams: Promise.resolve({ redirect_url: redirectUrl }),
  })

  const props = findElementProps(page, signInMock)
  expect(props).not.toBeNull()

  return props!
}

describe("resolveCheckInBootstrapContextPayload", () => {
  it("uses the active class context by default", () => {
    expect(
      resolveCheckInBootstrapContextPayload({
        activeCourseSlug: "salsa",
        activeDate: "2026-06-03",
        activeTime: "20:00",
        durationMinutes: 60,
        latePaymentEntryOverride: null,
      })
    ).toEqual({
      courseSlug: "salsa",
      date: "2026-06-03",
      time: "20:00",
      durationMinutes: 60,
      linkedFromCourseSlug: "salsa",
    })
  })

  it("uses late-payment override context while preserving active duration", () => {
    expect(
      resolveCheckInBootstrapContextPayload({
        activeCourseSlug: "salsa",
        activeDate: "2026-06-03",
        activeTime: "20:00",
        durationMinutes: 75,
        latePaymentEntryOverride: {
          courseSlug: "bachata",
          date: "2026-06-04",
          time: "18:30",
        },
      })
    ).toEqual({
      courseSlug: "bachata",
      date: "2026-06-04",
      time: "18:30",
      durationMinutes: 75,
      linkedFromCourseSlug: "bachata",
    })
  })
})

describe("resolveCheckInActiveContext", () => {
  it("uses explicit QR context from search params", () => {
    const searchParams = new URLSearchParams("courseSlug=SALSA&date=2026-06-03&time=20:00")

    expect(
      resolveCheckInActiveContext({
        sourceCourses: [],
        shellVariant: "qr",
        searchParams,
        forcedCourseSlug: "bachata",
        nowTick: new Date("2026-06-03T12:00:00.000Z"),
      })
    ).toEqual({
      activeCourseSlug: "salsa",
      activeDate: "2026-06-03",
      activeTime: "20:00",
      contextIsValid: true,
    })
  })
})

describe("resolveSafeQrRedirect", () => {
  it("keeps the original /checkin QR context when required params are valid", () => {
    const candidate = "/checkin?courseSlug=salsa-1&date=2026-06-11&time=19%3A30&durationMinutes=75&fromQr=1&entry=existing"

    expect(resolveSafeQrRedirect(candidate)).toBe(candidate)
  })

  it("rejects unsafe, malformed, and incomplete redirect candidates", () => {
    expect(resolveSafeQrRedirect("https://evil.test/checkin?courseSlug=salsa-1&date=2026-06-11&time=19:30")).toBeUndefined()
    expect(resolveSafeQrRedirect("//evil.test/checkin?courseSlug=salsa-1&date=2026-06-11&time=19:30")).toBeUndefined()
    expect(resolveSafeQrRedirect("%2Fcheckin%3FcourseSlug%3Dsalsa-1%26date%3D2026-06-11%26time%3D19%253A30")).toBeUndefined()
    expect(resolveSafeQrRedirect("/client-profile?courseSlug=salsa-1&date=2026-06-11&time=19:30")).toBeUndefined()
    expect(resolveSafeQrRedirect("/checkin?courseSlug=salsa-1&date=invalid&time=19:30")).toBeUndefined()
    expect(resolveSafeQrRedirect("/checkin?courseSlug=salsa-1&date=2026-06-11&time=25:61")).toBeUndefined()
    expect(resolveSafeQrRedirect("/checkin?courseSlug=salsa-1&date=2026-06-11&time=19:30&durationMinutes=5")).toBeUndefined()
    expect(resolveSafeQrRedirect("/checkin?date=2026-06-11&time=19:30")).toBeUndefined()
    expect(resolveSafeQrRedirect(["/checkin?courseSlug=salsa-1&date=2026-06-11&time=19:30"])).toBeUndefined()
  })
})

describe("SignInPage", () => {
  it("forces the validated QR redirect and preserves the ordinary fallback", async () => {
    const redirectUrl = "/checkin?courseSlug=salsa-1&date=2026-06-11&time=19%3A30&durationMinutes=75&fromQr=1"

    const props = await getSignInProps(redirectUrl)

    expect(props.forceRedirectUrl).toBe(redirectUrl)
    expect(props.fallbackRedirectUrl).toBe("/client-profile")
  })

  it("falls back to the profile flow when the QR redirect is unsafe or missing", async () => {
    const unsafeProps = await getSignInProps("https://evil.test/checkin?courseSlug=salsa-1&date=2026-06-11&time=19:30")
    const defaultProps = await getSignInProps()

    expect(unsafeProps.forceRedirectUrl).toBeUndefined()
    expect(unsafeProps.fallbackRedirectUrl).toBe("/client-profile")
    expect(defaultProps.forceRedirectUrl).toBeUndefined()
    expect(defaultProps.fallbackRedirectUrl).toBe("/client-profile")
  })
})
