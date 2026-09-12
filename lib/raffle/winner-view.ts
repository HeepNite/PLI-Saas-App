/**
 * Winner exposure (design.md D5). Shared by the draw and screen-state
 * responses so the full `phoneE164` never leaves the server — only the
 * trailing 4 digits are exposed, which is enough for a winner to
 * self-identify without projecting a complete contactable identifier.
 */

export type RaffleWinnerView = {
  name: string
  phoneLast4: string
}

export const toWinnerView = (entry: { name: string; phoneE164: string }): RaffleWinnerView => ({
  name: entry.name,
  phoneLast4: entry.phoneE164.slice(-4),
})
