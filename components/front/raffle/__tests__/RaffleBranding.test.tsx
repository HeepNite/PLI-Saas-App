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

describe("raffle branding", () => {
  it("brands the public entry page without changing its form", async () => {
    expectBranding(renderToStaticMarkup(await RaffleEntryPage({ params: Promise.resolve({ slug: "ple-launch" }) })))
  })

  it.each(["waiting", "ready", "drawing", "reveal", "between_draws", "finished"] as const)(
    "brands the %s tablet surface with no video configured", (phase) => {
      const markup = renderToStaticMarkup(<RaffleScreenView phase={phase} prizeLabel="Grand Prize"
        countdownMs={1000} entryCount={3} entryUrl={null} videoUrl="" winner={{ name: "Jane Doe", phoneLast4: "1234" }}
        error={null} onDraw={() => {}} onNextDraw={() => {}} onVideoEnded={() => {}} />)
      expectBranding(markup)
      expect(markup).not.toContain("<video")
    },
  )
})
