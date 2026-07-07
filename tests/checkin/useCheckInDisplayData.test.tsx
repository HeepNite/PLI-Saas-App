// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import type { BootstrapResponse, PackageOfferContext } from "@/components/front/checkin/checkin.types"
import { useCheckInDisplayData } from "@/components/front/checkin/useCheckInDisplayData"
import { demoCourses, type CourseData } from "@/constants/courses"

type DisplaySnapshot = ReturnType<typeof useCheckInDisplayData>

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

const renderDisplay = async ({
  shellVariant,
  search,
  forcedCourseSlug = "",
  mode = "idle",
  hasActiveClerkSession = false,
  hasKioskPinSession = false,
  bootstrap = null,
  processingPackageCheckIn = false,
  hasPackageCheckInResult = false,
  hasPackageCheckInFailure = false,
  packageOfferContext = null,
  sourceCourses = demoCourses,
  nowTick = new Date("2026-04-02T18:00:00.000Z"),
}: {
  shellVariant: "qr" | "terminal"
  search?: string
  forcedCourseSlug?: string
  mode?: "idle" | "existing" | "new"
  hasActiveClerkSession?: boolean
  hasKioskPinSession?: boolean
  bootstrap?: BootstrapResponse | null
  processingPackageCheckIn?: boolean
  hasPackageCheckInResult?: boolean
  hasPackageCheckInFailure?: boolean
  packageOfferContext?: PackageOfferContext
  sourceCourses?: CourseData[]
  nowTick?: Date
}) => {
  let snapshot: DisplaySnapshot | null = null

  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const searchParams = new URLSearchParams(search || "")

  function Harness() {
    snapshot = useCheckInDisplayData({
      sourceCourses,
      shellVariant,
      hideQrPanel: false,
      pathname: "/checkin",
      searchParams,
      forcedDeviceMode: undefined,
      forcedCourseSlug,
      nowTick,
      origin: "https://pli.test",
      isCompactViewport: false,
      mode,
      hasActiveClerkSession,
      hasKioskPinSession,
      loadingBootstrap: false,
      bootstrap,
      visibleError: null,
      paymentsModalReady: false,
      existingRegularBookingOverride: null,
      openNewBooking: false,
      processingPackageCheckIn,
      hasPackageCheckInResult,
      hasPackageCheckInFailure,
      packageOfferContext,
    })

    return null
  }

  await act(async () => {
    root.render(<Harness />)
  })

  return {
    getSnapshot: () => {
      if (!snapshot) {
        throw new Error("Display snapshot not ready")
      }
      return snapshot
    },
    root,
    container,
  }
}

const createBootstrap = (overrides: Partial<BootstrapResponse> = {}): BootstrapResponse => ({
  context: {
    courseSlug: "salsa-nocturno",
    courseTitle: "Salsa Nocturno",
    date: "2026-04-02",
    time: "20:10",
    durationMinutes: 60,
    startsAt: "2026-04-02T20:10:00.000Z",
    endsAt: "2026-04-02T21:10:00.000Z",
    checkInWindow: {
      isOpen: true,
      opensAt: "2026-04-02T19:55:00.000Z",
      closesAt: "2026-04-02T20:25:00.000Z",
    },
  },
  customer: {
    userId: "user-1",
    clerkUserId: "clerk-1",
    firstName: "Mora",
    lastName: "Diaz",
    name: "Mora Diaz",
    email: "mora@example.com",
    phone: "+1 929 387 6584",
    hasAvatar: false,
  },
  package: null,
  packages: [],
  quickCheckout: null,
  purchaseHistory: [],
  hasPreviousPurchase: false,
  hasAnyCompletedPurchase: false,
  ...overrides,
})

const createActivePackage = (): NonNullable<BootstrapResponse["package"]> => ({
  id: "user-package-1",
  packageId: "pkg-1",
  packageLabel: "5 Classes",
  isUnlimited: false,
  remainingCredits: 3,
  expiresAt: null,
  status: "active",
})

const createScheduledCourse = (overrides: Partial<CourseData>): CourseData => ({
  slug: "salsa-nocturno",
  title: "Salsa Nocturno",
  description: "Test course",
  level: "Beginner",
  duration: "60 min",
  schedule: {
    day: "Thursday",
    time: "8:10 PM",
    starts: "2026-04-02",
    availableWeekdays: [3],
    availableTimes: ["20:10"],
  },
  location: { address: "Studio" },
  instructors: [{ name: "PLI Team" }],
  enrollment: {
    services: [{ id: "drop-in", label: "Drop-in", price: 25 }],
    packages: [],
  },
  ...overrides,
})

describe("useCheckInDisplayData", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  testGlobal.IS_REACT_ACT_ENVIRONMENT = true

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
  })

  it("sets showPackageOfferScreen to false when packageOfferContext is null", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      packageOfferContext: null,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showPackageOfferScreen).toBe(false)
  })

  it("sets showPackageOfferScreen to true when packageOfferContext is set", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      packageOfferContext: {
        scenario: "dropin-upsell",
        previousPackageId: null,
        courseSlug: "salsa-nocturno",
        date: "2026-04-02",
        time: "20:10",
      },
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showPackageOfferScreen).toBe(true)
  })

  it("appends Package offer to breadcrumbs when package offer is active", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      packageOfferContext: {
        scenario: "expired-rebuy",
        previousPackageId: "pkg-abc",
        courseSlug: "salsa-nocturno",
        date: "2026-04-02",
        time: "20:10",
      },
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().breadcrumbItems).toEqual([
      "Terminal",
      "Existing customer",
      "Current course",
      "Package offer",
    ])
  })

  it("does not append Package offer to breadcrumbs when packageOfferContext is null", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      packageOfferContext: null,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().breadcrumbItems).toEqual([
      "Terminal",
      "Existing customer",
      "Current course",
    ])
  })

  it("handles new-user-upsell scenario for showPackageOfferScreen", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      packageOfferContext: {
        scenario: "new-user-upsell",
        previousPackageId: null,
        courseSlug: "salsa-nocturno",
        date: "2026-04-02",
        time: "20:10",
      },
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showPackageOfferScreen).toBe(true)
    expect(rendered.getSnapshot().breadcrumbItems).toContain("Package offer")
  })

  it("hides the QR missing-data warning on terminal shells without QR params", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      forcedCourseSlug: "salsa-nocturno",
      sourceCourses: [createScheduledCourse({})],
    })
    root = rendered.root
    container = rendered.container

    const snap = rendered.getSnapshot()
    expect(snap.activeCourseSlug).toBe("salsa-nocturno")
    expect(snap.activeDate).toBe("2026-04-02")
    expect(snap.activeTime).toBe("20:10")
    expect(snap.contextIsValid).toBe(true)
    expect(snap.showContextWarning).toBe(false)
    expect(snap.checkInQrLink).toContain("courseSlug=salsa-nocturno")
    expect(snap.checkInQrLink).toContain("date=2026-04-02")
    expect(snap.checkInQrLink).toContain("time=20%3A10")
  })

  it("does not jump to a future class when the terminal course has no slot today", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      forcedCourseSlug: "zumba-matutino",
      sourceCourses: [
        createScheduledCourse({
          slug: "zumba-matutino",
          title: "Zumba Matutino",
          schedule: {
            day: "Monday",
            time: "10:00 AM",
            starts: "2026-04-06",
            availableWeekdays: [0],
            availableTimes: ["10:00"],
          },
        }),
      ],
    })
    root = rendered.root
    container = rendered.container

    const snap = rendered.getSnapshot()
    expect(snap.activeCourseSlug).toBe("zumba-matutino")
    expect(snap.activeDate).toBe("")
    expect(snap.activeTime).toBe("")
    expect(snap.contextIsValid).toBe(false)
    expect(snap.showCourseCardPanel).toBe(true)
    expect(snap.showQrPanel).toBe(false)
    expect(snap.checkInQrLink).toBe("")
  })

  it("keeps the QR missing-data warning on QR shells without QR params", async () => {
    const rendered = await renderDisplay({ shellVariant: "qr", forcedCourseSlug: "" })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().contextIsValid).toBe(false)
    expect(rendered.getSnapshot().showContextWarning).toBe(true)
  })

  it("bypasses the kiosk PIN modal without showing the signed-in bootstrap panel after PIN identification", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showKioskPinPanel).toBe(false)
    expect(rendered.getSnapshot().showSignedInBootstrapPanel).toBe(false)
    expect(rendered.getSnapshot().hideEntrySelection).toBe(true)
    expect(rendered.getSnapshot().breadcrumbItems).toEqual(["Terminal", "Existing customer", "Current course"])
  })

  it("covers the package auto-check-in gap instead of showing the signed-in bootstrap panel", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      bootstrap: createBootstrap({ package: createActivePackage() }),
      hasPackageCheckInResult: false,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showKioskPinPanel).toBe(false)
    expect(rendered.getSnapshot().showKioskResolvingOverlay).toBe(true)
    expect(rendered.getSnapshot().showSignedInBootstrapPanel).toBe(false)
    expect(rendered.getSnapshot().hideEntrySelection).toBe(true)
  })

  it("keeps the signed-in bootstrap panel hidden for kiosk package users after package check-in produces a result", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      bootstrap: createBootstrap({ package: createActivePackage() }),
      hasPackageCheckInResult: true,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showKioskResolvingOverlay).toBe(false)
    expect(rendered.getSnapshot().showSignedInBootstrapPanel).toBe(false)
  })

  it("exits the resolving overlay deterministically once a package check-in failure is recorded (PR2 wiring, independent of setError/hasVisibleError)", async () => {
    // This proves the CALL SITE forwards hasPackageCheckInFailure into
    // shouldShowKioskResolvingOverlay — the pure gate itself was already
    // covered in PR1's kiosk-qr-payment.test.ts. visibleError is left null
    // here (not passed by this test harness) to prove the spinner-exit does
    // NOT depend on setError/hasVisibleError, only on the failure flag.
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      bootstrap: createBootstrap({ package: createActivePackage() }),
      hasPackageCheckInResult: false,
      hasPackageCheckInFailure: true,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showKioskResolvingOverlay).toBe(false)
  })

  it("keeps the resolving overlay up while hasPackageCheckInFailure is false and no result yet (default-preserves-behavior)", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      bootstrap: createBootstrap({ package: createActivePackage() }),
      hasPackageCheckInResult: false,
      hasPackageCheckInFailure: false,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showKioskResolvingOverlay).toBe(true)
  })

  it("shows the kiosk PIN panel when there is no kiosk pin session in existing mode", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: false,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showKioskPinPanel).toBe(true)
    expect(rendered.getSnapshot().breadcrumbItems).toEqual(["Terminal", "Existing customer", "Enter phone"])
  })
})
