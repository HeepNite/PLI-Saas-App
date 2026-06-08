// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import type { BootstrapResponse, PackageOfferContext } from "@/components/front/checkin/checkin.types"
import { useCheckInDisplayData } from "@/components/front/checkin/useCheckInDisplayData"
import { demoCourses } from "@/constants/courses"

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
  kioskPinRotationRequired = false,
  bootstrap = null,
  processingPackageCheckIn = false,
  hasPackageCheckInResult = false,
  packageOfferContext = null,
}: {
  shellVariant: "qr" | "terminal"
  search?: string
  forcedCourseSlug?: string
  mode?: "idle" | "existing" | "new"
  hasActiveClerkSession?: boolean
  hasKioskPinSession?: boolean
  kioskPinRotationRequired?: boolean
  bootstrap?: BootstrapResponse | null
  processingPackageCheckIn?: boolean
  hasPackageCheckInResult?: boolean
  packageOfferContext?: PackageOfferContext
}) => {
  let snapshot: DisplaySnapshot | null = null

  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const searchParams = new URLSearchParams(search || "")

  function Harness() {
    snapshot = useCheckInDisplayData({
      sourceCourses: demoCourses,
      shellVariant,
      hideQrPanel: false,
      pathname: "/checkin",
      searchParams,
      forcedDeviceMode: undefined,
      forcedCourseSlug,
      nowTick: new Date("2026-04-02T18:00:00.000Z"),
      origin: "https://pli.test",
      isCompactViewport: false,
      mode,
      hasActiveClerkSession,
      hasKioskPinSession,
      kioskPinRotationRequired,
      loadingBootstrap: false,
      bootstrap,
      visibleError: null,
      paymentsModalReady: false,
      existingRegularBookingOverride: null,
      openNewBooking: false,
      processingPackageCheckIn,
      hasPackageCheckInResult,
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
    const rendered = await renderDisplay({ shellVariant: "terminal" })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().activeCourseSlug).toBe("salsa-nocturno")
    expect(rendered.getSnapshot().activeDate).toBe("2026-04-02")
    expect(rendered.getSnapshot().activeTime).toBe("20:10")
    expect(rendered.getSnapshot().contextIsValid).toBe(true)
    expect(rendered.getSnapshot().showContextWarning).toBe(false)
    expect(rendered.getSnapshot().checkInQrLink).toContain("courseSlug=salsa-nocturno")
    expect(rendered.getSnapshot().checkInQrLink).toContain("date=2026-04-02")
    expect(rendered.getSnapshot().checkInQrLink).toContain("time=20%3A10")
  })

  it("resolves terminal context from the configured course schedule without QR params", async () => {
    const rendered = await renderDisplay({ shellVariant: "terminal", forcedCourseSlug: "zumba-matutino" })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().activeCourseSlug).toBe("zumba-matutino")
    expect(rendered.getSnapshot().activeDate).toBe("2026-04-06")
    expect(rendered.getSnapshot().activeTime).toBe("10:00")
    expect(rendered.getSnapshot().contextIsValid).toBe(true)
    expect(rendered.getSnapshot().showCourseCardPanel).toBe(true)
    expect(rendered.getSnapshot().checkInQrLink).toContain("courseSlug=zumba-matutino")
    expect(rendered.getSnapshot().checkInQrLink).toContain("date=2026-04-06")
    expect(rendered.getSnapshot().checkInQrLink).toContain("time=10%3A00")
  })

  it("keeps the QR missing-data warning on QR shells without QR params", async () => {
    const rendered = await renderDisplay({ shellVariant: "qr", forcedCourseSlug: "" })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().contextIsValid).toBe(false)
    expect(rendered.getSnapshot().showContextWarning).toBe(true)
  })

  it("bypasses the kiosk PIN modal after a permanent PIN identifies an active kiosk session", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      kioskPinRotationRequired: false,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showKioskPinPanel).toBe(false)
    expect(rendered.getSnapshot().showSignedInBootstrapPanel).toBe(true)
    expect(rendered.getSnapshot().hideEntrySelection).toBe(true)
    expect(rendered.getSnapshot().breadcrumbItems).toEqual(["Terminal", "Existing customer", "Current course"])
  })

  it("covers the package auto-check-in gap instead of showing the signed-in bootstrap panel", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      kioskPinRotationRequired: false,
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

  it("shows the signed-in bootstrap panel again after package check-in produces a result", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      kioskPinRotationRequired: false,
      bootstrap: createBootstrap({ package: createActivePackage() }),
      hasPackageCheckInResult: true,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showKioskResolvingOverlay).toBe(false)
    expect(rendered.getSnapshot().showSignedInBootstrapPanel).toBe(true)
  })

  it("keeps the kiosk PIN modal open when the identified PIN still requires rotation", async () => {
    const rendered = await renderDisplay({
      shellVariant: "terminal",
      mode: "existing",
      hasKioskPinSession: true,
      kioskPinRotationRequired: true,
    })
    root = rendered.root
    container = rendered.container

    expect(rendered.getSnapshot().showKioskPinPanel).toBe(true)
    expect(rendered.getSnapshot().breadcrumbItems).toEqual(["Terminal", "Existing customer", "Rotate PIN"])
  })
})
