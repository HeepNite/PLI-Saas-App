# International Phone Entry Design

## Design intent

Use one environment-neutral phone domain and one controlled UI field. Feature flows own their own submission state; the phone boundary owns country selection, national draft formatting, strict parsing, and canonical output.

```text
country selector + national draft/keypad
  -> InternationalPhoneField
  -> lib/phone domain
       -> valid { country, nationalDisplay, e164, digits }
       -> typed invalid result
  -> existing feature action
  -> route revalidates
  -> exact Clerk/local/purchase resolution
  -> existing checkout, SMS, recovery, or kiosk behavior
```

## Shared domain

Create/retain `lib/phone/` as client/server-safe code with no React, Prisma, Clerk, or route imports.

```ts
type ParsedPhone = {
  country: CountryCode
  nationalNumber: string
  nationalDisplay: string
  e164: string
  digits: string
}

parseNationalPhone(input: string, country: CountryCode): PhoneParseResult
parseCanonicalPhone(input: string): PhoneParseResult
formatNationalDraft(input: string, country: CountryCode): string
buildExactPhoneLookup(phone: ParsedPhone): { e164: string; digitCandidates: string[] }
```

Successful parsing requires one concrete supported country. `buildExactPhoneLookup()` returns canonical digits for every country and appends the parser-derived ten-digit national number only for US.

## UI boundary

`InternationalPhoneField` receives controlled selected-country and national-draft state and emits canonical E.164 only for valid input. It builds catalog/search data from parser metadata, integrates `KioskNumericKeypad`, preserves draft across errors, and does not call APIs or identity services.

The field initializes US only for empty input. For canonical prefills it derives country/national digits. A switch retains digits, clears stale E.164, then reformats and parses again.

## Work Unit 1 integration path

1. `app/special-salsa-class/page.tsx` -> `SpecialSalsaClassExperience` -> `SpecialSalsaClassLanding` renders the field inside its existing reservation dialog.
2. The dialog sends the emitted E.164 unchanged in its existing special checkout request.
3. `app/api/checkout/session/route.ts` keeps the existing special checkout discriminator and calls `resolveSpecialClassIdentity`.
4. `lib/checkout/special-class-identity.ts` parses canonical input, executes separate exact email/phone Clerk and local lookups, rejects conflicts, and passes E.164 to reservation persistence.
5. Existing `admitSpecialClassReservation` retains capacity, idempotency, and Stripe-session responsibilities; it must not reinterpret phone data.

## Broader boundaries

- Enrollment/EmbeddedSignIn replace US-only formatting and completion gates with field output while retaining phase and SMS behavior.
- Returning kiosk phone identification validates before terminal-miss accounting and uses exact candidate queries.
- QR/new-student verification, checkout preparation, recovery, Clerk helpers, and local-user helpers accept canonical E.164 through the shared domain before lookup or mutation.
- Existing `normalizePhone` must not remain an authoritative validation or international lookup policy; limited legacy callers may remain only behind an adapter with tests.

## Test design

| Layer | Required proof |
| --- | --- |
| Domain | US/MX/AR valid national numbers; strict extraction rejection; invalid/unresolved input; country switching; E.164/digits; US-only legacy candidate. |
| Special Salsa component | US default; selector search; MX/AR national entry; disabled invalid submit; retained draft; keyboard/touch accessibility; no change to video controls/reduced-motion behavior. |
| Special Salsa route/identity | Exact Clerk/local lookups; conflicts; invalid input and parser errors perform zero Clerk/local/hold mutations; E.164 reaches purchase/Stripe preparation. |
| Kiosk/QR/enrollment | Invalid input consumes no miss; exact international lookup has no suffix match; canonical E.164 reaches SMS/recovery/checkout; current US behavior remains. |
| E2E | Special Salsa reservation at phone viewport, then US and international enrollment/returning flows after activation. |

## Failure contract

Routes return existing or stable generic non-sensitive errors. UI retains country and national draft. Parser/metadata exceptions, identity conflicts, and ambiguous local results must stop before any identity, recovery, or checkout mutation.
