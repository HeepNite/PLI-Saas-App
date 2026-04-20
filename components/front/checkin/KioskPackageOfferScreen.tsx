"use client"

import React, { useEffect } from "react"
import type { PackageOfferScenario } from "@/components/front/checkin/checkin.types"
import type { EnrollmentOption } from "@/constants/courses"
import { createKioskInactivityController } from "@/lib/checkin/kiosk-inactivity"

export type KioskPackageOfferScreenProps = {
  scenario: PackageOfferScenario
  packages: EnrollmentOption[]
  previousPackageId: string | null
  courseName: string
  onSelectPackage: (packageId: string) => void
  onDecline: () => void
  onTimeout: () => void
}

const HEADERS: Record<PackageOfferScenario, string> = {
  "dropin-upsell": "Save with a class package",
  "expired-rebuy": "Your package has ended — renew?",
  "new-user-upsell": "Want to save on future classes?",
}

const DECLINE_LABELS: Record<PackageOfferScenario, string> = {
  "dropin-upsell": "Continue with single class",
  "expired-rebuy": "Pay single class instead",
  "new-user-upsell": "No thanks, I'm done",
}

export default function KioskPackageOfferScreen({
  scenario,
  packages,
  previousPackageId,
  courseName,
  onSelectPackage,
  onDecline,
  onTimeout,
}: KioskPackageOfferScreenProps) {
  useEffect(() => {
    const controller = createKioskInactivityController({ onTimeout })
    controller.arm()
    return () => {
      controller.dispose()
    }
  }, [onTimeout])

  const header = HEADERS[scenario]
  const declineLabel = DECLINE_LABELS[scenario]

  return (
    <div
      data-testid="kiosk-package-offer"
      className="fixed inset-0 z-[10500] flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm px-4 pb-4 pt-24 sm:px-6 sm:pb-5 sm:pt-28 md:pb-6 md:pt-32 lg:pt-10"
    >
      <div className="w-full max-w-lg space-y-6 text-center rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">{courseName}</p>
        <h2 className="text-2xl font-semibold leading-tight text-white">{header}</h2>

        <div className="space-y-3 pt-2">
          {packages.map((pkg) => {
            const isPrevious = previousPackageId != null && pkg.id === previousPackageId
            return (
              <button
                key={pkg.id}
                type="button"
                data-testid={`package-card-${pkg.id}`}
                onClick={() => onSelectPackage(pkg.id)}
                className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                  isPrevious
                    ? "border-[rgba(182,22,22,0.55)] bg-[rgba(182,22,22,0.12)] shadow-[0_0_0_1px_rgba(182,22,22,0.16)]"
                    : "border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{pkg.label}</p>
                    {pkg.description && (
                      <p className="mt-1 text-sm text-white/60">{pkg.description}</p>
                    )}
                    {pkg.meta?.totalClasses != null && (
                      <p className="mt-1 text-xs text-white/50">
                        {pkg.meta.totalClasses} classes
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {pkg.price != null && (
                      <p className="text-lg font-semibold text-white">
                        ${(pkg.price / 100).toFixed(0)}
                      </p>
                    )}
                    {isPrevious && (
                      <span
                        data-testid="rebuy-badge"
                        className="mt-1 inline-block rounded-full bg-[var(--brand,#b61616)] px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
                      >
                        Rebuy
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          data-testid="decline-button"
          onClick={onDecline}
          className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          {declineLabel}
        </button>
      </div>
    </div>
  )
}
