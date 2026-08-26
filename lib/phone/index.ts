import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberWithError,
  validatePhoneNumberLength,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/max"

export type ParsedPhone = {
  country: CountryCode
  callingCode: string
  nationalNumber: string
  nationalDisplay: string
  e164: string
  digits: string
}

export type PhoneParseFailureReason =
  | "empty"
  | "incomplete"
  | "invalid"
  | "unsupported_country"
  | "unresolved_country"
  | "non_geographic"

export type PhoneParseResult =
  | { ok: true; phone: ParsedPhone }
  | { ok: false; reason: PhoneParseFailureReason }

export type PhoneCountryCatalogEntry = {
  country: CountryCode
  callingCode: string
}

const supportedCountries = getCountries()
const supportedCountrySet = new Set<CountryCode>(supportedCountries)
const phoneCountryCatalog = supportedCountries.map((country) => ({
  country,
  callingCode: getCountryCallingCode(country),
}))

const failure = (reason: PhoneParseFailureReason): PhoneParseResult => ({ ok: false, reason })
const isIncompleteError = (error: unknown) => error instanceof Error && error.message === "TOO_SHORT"

const toParsedPhone = (phone: PhoneNumber): PhoneParseResult => {
  if (phone.isNonGeographic()) return failure("non_geographic")
  if (!phone.country) return failure("unresolved_country")
  if (!supportedCountrySet.has(phone.country)) return failure("unsupported_country")
  if (!phone.isValid()) return failure("invalid")

  return {
    ok: true,
    phone: {
      country: phone.country,
      callingCode: phone.countryCallingCode,
      nationalNumber: phone.nationalNumber,
      nationalDisplay: phone.formatNational(),
      e164: phone.number,
      digits: phone.number.slice(1),
    },
  }
}

export const getPhoneCountryCatalog = (): PhoneCountryCatalogEntry[] =>
  phoneCountryCatalog.map((entry) => ({ ...entry }))

export const parseNationalPhone = (input: string, country: CountryCode): PhoneParseResult => {
  const value = input.trim()
  if (!value) return failure("empty")
  if (!isSupportedCountry(country)) return failure("unsupported_country")
  if (value.startsWith("+")) return failure("invalid")

  try {
    const phone = parsePhoneNumberWithError(value, { defaultCountry: country, extract: false })
    if (phone.country !== country) return failure("unsupported_country")
    if (!phone.isValid()) {
      const length = validatePhoneNumberLength(value, { defaultCountry: country })
      return failure(length === "TOO_SHORT" ? "incomplete" : "invalid")
    }
    return toParsedPhone(phone)
  } catch (error) {
    return failure(isIncompleteError(error) ? "incomplete" : "invalid")
  }
}

export const parseCanonicalPhone = (input: string): PhoneParseResult => {
  const value = input.trim()
  if (!value) return failure("empty")
  if (!value.startsWith("+")) return failure("invalid")

  try {
    const phone = parsePhoneNumberWithError(value, { extract: false })
    if (phone.number !== value) return failure("invalid")
    if (!phone.isValid() && validatePhoneNumberLength(value) === "TOO_SHORT") return failure("incomplete")
    return toParsedPhone(phone)
  } catch (error) {
    return failure(isIncompleteError(error) ? "incomplete" : "invalid")
  }
}

export const parseServerPhoneInput = (input: string): PhoneParseResult => {
  const value = input.trim()
  const canonical = parseCanonicalPhone(value)
  if (canonical.ok || !value) return canonical
  if (/^\d{10}$/.test(value)) return parseNationalPhone(value, "US")
  if (!/^\+1[\d\s().-]+$/.test(value)) return canonical

  const digits = value.replace(/\D/g, "")
  if (!/^1\d{10}$/.test(digits)) return canonical
  return parseNationalPhone(digits.slice(1), "US")
}

export const isNationalPhoneDraft = (input: string) => /^[\d\s().-]*$/.test(input)

export const formatNationalDraft = (input: string, country: CountryCode): string => {
  if (!isSupportedCountry(country)) return ""
  if (!isNationalPhoneDraft(input)) return ""
  try {
    return new AsYouType(country).input(input.replace(/\D/g, ""))
  } catch {
    return ""
  }
}

export const buildExactPhoneLookup = (phone: ParsedPhone) => {
  const digitCandidates = [phone.digits]
  if (phone.country === "US" && phone.nationalNumber.length === 10) {
    digitCandidates.push(phone.nationalNumber)
  }
  return { e164: phone.e164, digitCandidates }
}
