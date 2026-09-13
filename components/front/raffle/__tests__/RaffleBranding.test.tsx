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
      if (phase === "reveal") expectPrimaryAction(markup, "Next draw")
      expect(markup).not.toContain("<video")
    },
  )
})
