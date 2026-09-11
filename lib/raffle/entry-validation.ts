import { parseNationalPhone } from "@/lib/phone"

type SupportedCountry = Parameters<typeof parseNationalPhone>[1]

export type RaffleEntryInput = {
  name: string
  phoneE164: string
  phoneCountry: string
}

export type RaffleEntryValidationStatus = "invalid_body" | "invalid_name" | "invalid_phone"

export type RaffleEntryValidationResult =
  | { ok: true; value: RaffleEntryInput }
  | { ok: false; status: RaffleEntryValidationStatus }

const invalid = (status: RaffleEntryValidationStatus): RaffleEntryValidationResult => ({ ok: false, status })

const hasNonDigit = (value: string) => /\D/.test(value)

const DEFAULT_COUNTRY = "US"

export const parseRaffleEntryInput = (body: unknown): RaffleEntryValidationResult => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("invalid_body")

  const record = body as Record<string, unknown>
  const { name, phone, country } = record

  if (typeof name !== "string" || typeof phone !== "string") return invalid("invalid_body")
  if (country !== undefined && typeof country !== "string") return invalid("invalid_body")

  const trimmedName = name.trim()
  if (trimmedName.length < 2 || trimmedName.length > 60 || !hasNonDigit(trimmedName)) {
    return invalid("invalid_name")
  }

  const resolvedCountry = (country?.trim() || DEFAULT_COUNTRY) as SupportedCountry
  const parsedPhone = parseNationalPhone(phone, resolvedCountry)
  if (!parsedPhone.ok) return invalid("invalid_phone")

  return {
    ok: true,
    value: {
      name: trimmedName,
      phoneE164: parsedPhone.phone.e164,
      phoneCountry: parsedPhone.phone.country,
    },
  }
}
