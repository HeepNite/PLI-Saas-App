// @vitest-environment jsdom
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import RaffleEntryPage from "@/app/raffle/[slug]/page"
import RaffleScreenView from "../RaffleScreenView"

vi.mock("@/lib/prisma", () => ({ prisma: { raffleEvent: { findUnique: vi.fn(async () => ({
  title: "Latin Events", eventDate: new Date("2099-09-12"),
})) } } }))

function expectBranding(markup: string) {
  const node = document.createElement("div")
  node.innerHTML = markup
  const logo = node.querySelector('img[alt="Palladium Latin Events"]')!
  expect(logo.getAttribute("src")).toBe("/raffle/event-logo.webp")
  expect(logo.classList.contains("object-contain")).toBe(true)
  expect(logo.parentElement?.classList.contains("bg-white")).toBe(true)
  const backdrop = node.querySelector('[data-testid="raffle-backdrop"]') as HTMLElement
  expect(backdrop.style.backgroundImage).toContain("/raffle/event-background.webp")
  expect(backdrop.style.backgroundImage).toContain("0.7")
  expect(backdrop.classList.contains("bg-cover")).toBe(true)
}

function expectPrimaryAction(markup: string, label: string) {
  const node = document.createElement("div")
  node.innerHTML = markup
  const button = Array.from(node.querySelectorAll("button")).find((item) => item.textContent === label)!
  expect(button).toBeDefined()
  for (const token of [
    "bg-[linear-gradient(180deg,#6d1245_0%,#401f4c_100%)]", "text-white",
    "focus-visible:ring-2", "focus-visible:ring-white", "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-[#401f4c]", "disabled:cursor-not-allowed", "disabled:saturate-50",
  ]) expect(button.classList.contains(token)).toBe(true)
  expect(button.className).not.toContain("var(--brand")
  expect(button.className).not.toContain("opacity-")
}

describe("raffle branding", () => {
  it.each(["waiting", "ready", "drawing", "reveal", "between_draws", "finished"] as const)(
    "limits each October background video in phase %s", (phase) => {
      for (const slug of ["october-31-raffle-2026", "october-30-raffle-2026", "ple-launch"]) {
        const markup = renderToStaticMarkup(<RaffleScreenView slug={slug} phase={phase} prizeLabel="Grand Prize"
          countdownMs={1000} entryCount={3} entryUrl={null} videoUrl="" winner={{ name: "Jane Doe", phoneLast4: "1234" }}
          error={null} onDraw={() => {}} onNextDraw={() => {}} onVideoEnded={() => {}} />)
        const node = document.createElement("div")
        node.innerHTML = markup
        const video = node.querySelector('[data-testid="raffle-background-video"]')
        const expectedSrc = ["waiting", "ready"].includes(phase)
          ? slug === "october-31-raffle-2026" ? "/raffle/tapville-halloween-background.mp4"
            : slug === "october-30-raffle-2026" ? "/raffle/inka-halloween-background.mp4" : null
          : null
        expect(video?.getAttribute("src") ?? null).toBe(expectedSrc)
        expectBranding(markup)
        if (expectedSrc) {
          for (const attribute of ["autoplay", "loop", "muted", "playsinline"]) {
            expect(video?.hasAttribute(attribute)).toBe(true)
          }
          expect(video?.getAttribute("aria-hidden")).toBe("true")
          expect(video?.parentElement?.classList.contains("pointer-events-none")).toBe(true)
          expect(node.querySelector('[data-testid="raffle-background-shade"]')).toBeNull()
          expect(video?.classList.contains("object-contain")).toBe(true)
          expect(video?.classList.contains("object-cover")).toBe(false)
          expect(video?.classList.contains("h-full")).toBe(true)
          expect(video?.classList.contains("w-full")).toBe(true)
          expect(node.querySelector('[data-testid="raffle-backdrop"]')?.classList.contains("min-h-dvh")).toBe(true)
          expect(node.textContent).toContain("3 entered")
          expect(node.textContent).toContain("Grand Prize")
          if (phase === "ready") expectPrimaryAction(markup, "Draw")
        }
      }
    },
  )

  it.each(["waiting", "ready"] as const)("shows a larger encoded QR without a URL label on October %s screens only", (phase) => {
    const entryUrl = "https://thepalladium.art/raffle/october-30-raffle-2026"
    for (const slug of ["october-30-raffle-2026", "october-31-raffle-2026", "ple-launch"]) {
      const markup = renderToStaticMarkup(<RaffleScreenView slug={slug} phase={phase} prizeLabel="Grand Prize"
        countdownMs={1000} entryCount={3} entryUrl={entryUrl} videoUrl="" winner={null}
        error={null} onDraw={() => {}} onNextDraw={() => {}} onVideoEnded={() => {}} />)
      const node = document.createElement("div")
      node.innerHTML = markup
      const qr = node.querySelector('[data-testid="raffle-qr-image"]') as HTMLImageElement
      const october = slug !== "ple-launch"
      const size = october ? 192 : 160
      expect(qr.getAttribute("width")).toBe(String(size))
      expect(qr.getAttribute("height")).toBe(String(size))
      expect(qr.src).toBe(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&data=${encodeURIComponent(entryUrl)}`)
      expect(node.textContent?.includes(entryUrl)).toBe(!october)
      expect(node.querySelector('[data-testid="raffle-backdrop"]')?.classList.contains("min-h-dvh")).toBe(true)
    }
  })

  it("brands the public entry page without changing its form", async () => {
    const markup = renderToStaticMarkup(await RaffleEntryPage({ params: Promise.resolve({ slug: "ple-launch" }) }))
    expectBranding(markup)
    expectPrimaryAction(markup, "Enter raffle")
  })

  it.each(["waiting", "ready", "drawing", "reveal", "between_draws", "finished"] as const)(
    "brands the %s tablet surface with no video configured", (phase) => {
      const markup = renderToStaticMarkup(<RaffleScreenView phase={phase} prizeLabel="Grand Prize"
        countdownMs={1000} entryCount={3} entryUrl={null} videoUrl="" winner={{ name: "Jane Doe", phoneLast4: "1234" }}
        error={null} onDraw={() => {}} onNextDraw={() => {}} onVideoEnded={() => {}} />)
      expectBranding(markup)
      if (phase === "ready") expectPrimaryAction(markup, "Draw")
      if (phase === "reveal") expectPrimaryAction(markup, "Showed up")
      expect(markup).not.toContain("<video")
    },
  )
})
