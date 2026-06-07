import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import KioskPackageOfferScreen from "@/components/front/checkin/KioskPackageOfferScreen"
import type { PackageOfferScenario } from "@/components/front/checkin/checkin.types"
import type { EnrollmentOption } from "@/constants/courses"

vi.mock("@/lib/checkin/kiosk-inactivity", () => ({
  createKioskInactivityController: vi.fn(({ onTimeout }) => ({
    arm: vi.fn(),
    dispose: vi.fn(),
    _triggerTimeout: onTimeout,
  })),
}))

const basePackages: EnrollmentOption[] = [
  { id: "pkg-5", label: "5 Class Package", price: 4500, meta: { totalClasses: 5 } },
  { id: "pkg-10", label: "10 Class Package", price: 8000, meta: { totalClasses: 10 } },
]

function renderScenario(
  scenario: PackageOfferScenario,
  overrides: Partial<React.ComponentProps<typeof KioskPackageOfferScreen>> = {},
) {
  return renderToStaticMarkup(
    <KioskPackageOfferScreen
      scenario={scenario}
      packages={basePackages}
      previousPackageId={null}
      courseName="Salsa Nocturno"
      onSelectPackage={() => {}}
      onDecline={() => {}}
      onTimeout={() => {}}
      {...overrides}
    />,
  )
}

describe("KioskPackageOfferScreen", () => {
  // ── Scenario 1: dropin-upsell ──────────────────────────────────────────

  describe("dropin-upsell", () => {
    it("renders the save header and both package cards", () => {
      const markup = renderScenario("dropin-upsell")

      expect(markup).toContain("Save with a class package")
      expect(markup).toContain("5 Class Package")
      expect(markup).toContain("10 Class Package")
    })

    it("renders the decline action with the single-class label", () => {
      const markup = renderScenario("dropin-upsell")

      expect(markup).toContain("Continue with single class")
    })

    it("does NOT show the previous-package badge", () => {
      const markup = renderScenario("dropin-upsell")

      expect(markup).not.toContain("Your previous package")
      expect(markup).not.toContain("Rebuy")
    })
  })

  // ── Scenario 2: expired-rebuy ──────────────────────────────────────────

  describe("expired-rebuy", () => {
    it("renders the renewal header", () => {
      const markup = renderScenario("expired-rebuy")

      expect(markup).toContain("Your package has ended")
    })

    it("highlights the previous package with the Rebuy badge", () => {
      const markup = renderScenario("expired-rebuy", {
        previousPackageId: "pkg-5",
      })

      expect(markup).toContain("Rebuy")
    })

    it("renders the decline action for single-class fallback", () => {
      const markup = renderScenario("expired-rebuy")

      expect(markup).toContain("Pay single class instead")
    })
  })

  // ── Scenario 3: new-user-upsell ────────────────────────────────────────

  describe("new-user-upsell", () => {
    it("renders the future-savings header", () => {
      const markup = renderScenario("new-user-upsell")

      expect(markup).toContain("Want to save on future classes")
    })

    it("renders both package cards", () => {
      const markup = renderScenario("new-user-upsell")

      expect(markup).toContain("5 Class Package")
      expect(markup).toContain("10 Class Package")
    })

    it("renders the decline action with the done label", () => {
      const markup = renderScenario("new-user-upsell")

      expect(markup).toContain("No thanks")
    })
  })

  // ── Cross-scenario assertions ──────────────────────────────────────────

  it("uses z-[10500] layering", () => {
    const markup = renderScenario("dropin-upsell")

    expect(markup).toContain("z-[10500]")
  })

  it("includes the course name in the screen", () => {
    const markup = renderScenario("dropin-upsell")

    expect(markup).toContain("Salsa Nocturno")
  })

  it("does NOT show previousPackageId badge when previousPackageId is null", () => {
    const markup = renderScenario("expired-rebuy", { previousPackageId: null })

    expect(markup).not.toContain("Rebuy")
  })

  it("does NOT render Rebuy badge for non-matching previousPackageId", () => {
    const markup = renderScenario("expired-rebuy", {
      previousPackageId: "pkg-not-in-list",
    })

    // Component renders but no Rebuy badge since pkg-not-in-list is not in the packages array
    expect(markup).toContain("Your package has ended")
    expect(markup).not.toContain("Rebuy")
  })

  // ── Price and metadata rendering ───────────────────────────────────────

  it("renders the formatted price for each package", () => {
    const markup = renderScenario("dropin-upsell")

    // 4500 cents → $45, 8000 cents → $80
    expect(markup).toContain("$45")
    expect(markup).toContain("$80")
  })

  it("renders the totalClasses meta when present", () => {
    const markup = renderScenario("dropin-upsell")

    expect(markup).toContain("5 classes")
    expect(markup).toContain("10 classes")
  })

  it("renders package description when provided", () => {
    const packagesWithDesc: EnrollmentOption[] = [
      { id: "pkg-1", label: "Starter", description: "Great for beginners", price: 2000 },
    ]
    const markup = renderToStaticMarkup(
      <KioskPackageOfferScreen
        scenario="dropin-upsell"
        packages={packagesWithDesc}
        previousPackageId={null}
        courseName="Yoga"
        onSelectPackage={() => {}}
        onDecline={() => {}}
        onTimeout={() => {}}
      />,
    )

    expect(markup).toContain("Great for beginners")
  })

  it("handles a single package without layout issues", () => {
    const singlePackage: EnrollmentOption[] = [
      { id: "pkg-only", label: "Only Package", price: 5000 },
    ]
    const markup = renderToStaticMarkup(
      <KioskPackageOfferScreen
        scenario="new-user-upsell"
        packages={singlePackage}
        previousPackageId={null}
        courseName="Zumba"
        onSelectPackage={() => {}}
        onDecline={() => {}}
        onTimeout={() => {}}
      />,
    )

    expect(markup).toContain("Only Package")
    expect(markup).toContain("$50")
    expect(markup).toContain("No thanks")
  })

  it("does not render price when package has no price", () => {
    const noPricePkg: EnrollmentOption[] = [
      { id: "free", label: "Free Trial", meta: { totalClasses: 1 } },
    ]
    const markup = renderToStaticMarkup(
      <KioskPackageOfferScreen
        scenario="dropin-upsell"
        packages={noPricePkg}
        previousPackageId={null}
        courseName="Pilates"
        onSelectPackage={() => {}}
        onDecline={() => {}}
        onTimeout={() => {}}
      />,
    )

    expect(markup).toContain("Free Trial")
    expect(markup).toContain("1 classes")
    // Should not contain any dollar amount for this card
    expect(markup).not.toContain(">$")
  })
})
