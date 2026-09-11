// Shared slug validator for every public/staff raffle route keyed by `[slug]`.
// Kept as its own module so the entry API (PR2) and the screen-token exchange
// (PR4a, per design.md D2) can both depend on it without duplicating the pattern.
const RAFFLE_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/

export const isRaffleSlug = (value: string): boolean => RAFFLE_SLUG_PATTERN.test(value)
