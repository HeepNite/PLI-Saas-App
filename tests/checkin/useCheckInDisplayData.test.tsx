// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
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
}: {
  shellVariant: "qr" | "terminal"
  search?: string
  forcedCourseSlug?: string
  mode?: "idle" | "existing" | "new"
  hasActiveClerkSession?: boolean
  hasKioskPinSession?: boolean
  kioskPinRotationRequired?: boolean
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
      bootstrap: null,
      visibleError: null,
      paymentsModalReady: false,
      existingRegularBookingOverride: null,
      openNewBooking: false,
      processingPackageCheckIn: false,
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
