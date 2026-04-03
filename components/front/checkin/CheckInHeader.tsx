"use client"

import React from "react"
import Image from "next/image"

export function CheckInHeader({
  variant,
  eyebrow,
  welcomeLabel,
  showWelcome,
  breadcrumbItems,
}: {
  variant: "terminal" | "personal"
  eyebrow: string
  welcomeLabel: string
  showWelcome: boolean
  breadcrumbItems: string[]
}) {
  if (variant === "terminal") {
    return (
      <div className="mt-4 grid grid-cols-1 items-center gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-6">
        <div className="mx-auto inline-flex items-center md:mx-0 md:justify-self-start">
          <Image
            src="/logo/logo-white.png"
            alt="Palladium Latin Art"
            width={120}
            height={48}
            className="h-auto w-[calc(var(--spacing)*30)] object-contain"
          />
        </div>
        <div className="text-center md:justify-self-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">{eyebrow}</p>
          <h1 className="text-2xl font-semibold text-white">Student check-in</h1>
          <p className="mt-1 text-sm text-white/72">{showWelcome ? `Welcome, ${welcomeLabel}` : "Welcome"}</p>
        </div>
        <nav
          className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-white/55 md:justify-self-end md:justify-end"
          aria-label="Breadcrumb"
        >
          {breadcrumbItems.map((item, index) => (
            <React.Fragment key={`${item}-${index}`}>
              {index > 0 && <span className="text-white/35">/</span>}
              <span className={index === breadcrumbItems.length - 1 ? "text-white/80" : ""}>{item}</span>
            </React.Fragment>
          ))}
        </nav>
      </div>
    )
  }

  return (
    <>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">{eyebrow}</p>
        <Image
          src="/logo/logo-white.png"
          alt="Palladium Latin Art"
          width={120}
          height={48}
          className="h-auto w-[calc(var(--spacing)*20)] object-contain"
        />
      </div>
      <h1 className="mt-3 text-2xl font-semibold text-white">Student check-in</h1>
      <p className="text-sm text-white/70">
        {showWelcome ? `Welcome, ${welcomeLabel}` : "Welcome"}
      </p>
      {breadcrumbItems.length > 1 && (
        <nav className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/55" aria-label="Breadcrumb">
          {breadcrumbItems.map((item, index) => (
            <React.Fragment key={`${item}-${index}`}>
              {index > 0 && <span className="text-white/35">/</span>}
              <span className={index === breadcrumbItems.length - 1 ? "text-white/80" : ""}>{item}</span>
            </React.Fragment>
          ))}
        </nav>
      )}
    </>
  )
}
