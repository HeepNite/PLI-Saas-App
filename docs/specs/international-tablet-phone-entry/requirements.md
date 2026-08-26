# International Phone Entry Requirements

## Status

`READY FOR IMPLEMENTATION PLANNING`

This is the single behavioral source of truth for country-aware phone entry. It refines the existing `international-tablet-phone-entry` specification; it does not create a second phone-entry feature.

## Outcome

Every application surface that asks a customer for a phone number must present a consistent country selector and accept a national number. The selector includes at least United States (US), Mexico (MX), and Argentina (AR), defaults to US only for an empty draft, and produces canonical E.164 without requiring a customer to type `+1`.

The first delivered vertical slice is the Special Salsa reservation flow for this Sunday.

## Scope

### In scope

- All customer-facing phone-entry surfaces, beginning with `app/special-salsa-class/page.tsx` and its reservation dialog, then enrollment, embedded sign-in, returning-student kiosk identification, QR/check-in, recovery, and any other discovered phone-entry caller.
- A reusable country selector, national-number input, keypad integration, accessibility, and country search.
- Strict parsing, canonical E.164 transport, canonical-digit persistence compatibility, exact identity lookup, Clerk interaction, checkout, recovery, and kiosk/QR identification.
- Regression coverage for current US callers and exact legacy US records.

### Non-goals

- No schema migration, historical backfill, new endpoint, phone UI dependency, account merge, or silent identity reconciliation.
- No change to authorization, throttling, pricing, Stripe capacity/hold behavior, SMS cooldown, recovery authorization, or attendance policy.
- No changes to non-phone fields or unrelated Special Salsa presentation behavior, including autoplay, unless a future implementation inspection proves a phone-flow dependency.

## Terms

| Term | Meaning |
| --- | --- |
| National draft | Digits entered for the explicitly selected country, without its calling prefix. |
| Canonical phone | Strict parser-owned E.164 such as `+12015550123`. |
| Canonical digits | Canonical phone without `+`; compatible with the current `User.phone` convention. |
| Legacy US candidate | The exact parser-derived ten-digit US national number, used only to read an old US row missing the leading `1`. |

## Requirements

### R1 — Country-aware entry

1. All in-scope phone forms use one shared controlled phone-entry boundary.
2. The country selector must contain US, MX, and AR at minimum and be generated from supported metadata rather than a hard-coded allowlist.
3. An empty field defaults to US. A resolvable E.164 prefill derives its country; an unresolved/non-geographic prefill fails closed and requires re-entry.
4. Customers enter a national number. The UI shows the selected calling code but must never require entering `+1` or any prefix manually.
5. Search matches country name, ISO code, and calling code with or without `+`; it preserves the current selection on cancel or no result.
6. A country switch retains entered national digits, invalidates the former canonical value, reformats, and revalidates under the newly selected country.
7. The current kiosk numeric keypad remains usable and has no universal ten-digit cap. Paste of a complete strict E.164 may derive country and national input; surrounding text must not be extracted.

### R2 — Canonical validation

1. Validity is determined only by a shared strict parser using explicit country selection for national drafts, `extract: false`, and metadata-backed validity.
2. Valid input produces parser-owned E.164. Clients transport that value unchanged; server boundaries independently validate it before lookup, SMS preparation, recovery, checkout, or identity mutation.
3. Invalid, incomplete, impossible, unresolvable, and parser-error inputs fail closed, preserve the draft, and cause no mutation, lookup side effect, terminal miss, or checkout hold.
4. Current formatted/raw US inputs remain accepted only as a backward-compatible server transition. Bare non-US digits are never guessed as a country.

### R3 — Identity and persistence safety

1. Clerk receives and is queried by exact canonical E.164. Local users and purchases are queried by exact canonical digits.
2. Only valid US canonical input may additionally query the exact parser-derived ten-digit legacy US candidate. No suffix, substring, `contains`, last-ten, or inferred-`+1` match is allowed for international input.
3. Email and phone must be resolved independently. Different Clerk users, different local users, multiple exact candidates, or incompatible links return a non-sensitive conflict before any create, update, link, reuse, SMS, checkout, or recovery mutation.
4. A legacy-US match never rewrites the stored number merely because it matched.

### R4 — Special Salsa first slice

1. `components/front/special-salsa-class/SpecialSalsaClassLanding.tsx` replaces its current prefix-required phone validation with the shared selector/national-entry experience.
2. Its form submits canonical E.164 to the existing `POST /api/checkout/session` special-class branch.
3. `lib/checkout/special-class-identity.ts` validates and resolves the canonical phone through the shared boundary before Clerk/local identity mutation; the reservation purchase receives the same canonical E.164.
4. Reservation failures retain country and national draft, remain non-sensitive, and preserve existing price, hold, capacity, idempotency, Stripe redirect, and unauthenticated guest-checkout behavior.

### R5 — Accessibility and interaction

1. Controls have persistent labels, visible focus, associated inline errors, keyboard operation, and touch targets of at least 44 by 44 CSS pixels.
2. The selector uses an accessible searchable combobox or dialog/listbox, announces selection and validity non-disruptively, and restores focus on close.
3. Busy actions prevent duplicate country, Continue, Verify, identify, and checkout submissions without clearing input.

## Acceptance scenarios

1. An empty Special Salsa form selects US; entering a valid US national number submits `+1...` without the customer typing `+1`.
2. A Mexico or Argentina selection accepts a valid national number and Special Salsa checkout/Clerk/local identity receive the identical E.164 value.
3. An invalid phone prevents the Special Salsa checkout request and all identity/hold mutation.
4. A canonical international phone finds only an exact local/Clerk identity; a same-suffix phone from another country cannot match.
5. An exact legacy ten-digit US row can match a valid US number but cannot match a non-US number and is not rewritten.
6. An email/phone cross-identity conflict returns a generic recoverable error before mutation.
7. Enrollment, embedded SMS sign-in, returning identification, kiosk/QR, and recovery produce the same canonical result for the same country/national input after their work units activate.

## Assumptions

- `libphonenumber-js/max` remains the approved single parser/catalog dependency; no second phone-input library is justified.
- `User.phone` and relevant purchase fields remain string-compatible with canonical digits/E.164 as currently used; implementation must stop and return to this spec if that proves false.
- The Special Salsa date, video/autoplay behavior, price, and reservation topology already have their own approved specification and are not phone-entry decisions.

## Definition of done

- [ ] Every discovered customer phone-entry surface is either migrated or explicitly recorded as out of scope with evidence.
- [ ] The Special Salsa vertical slice passes its component, route, identity, and checkout regressions before broader activation.
- [ ] All server boundaries reject malformed/conflicting input before mutation.
- [ ] US compatibility, US/MX/AR entry, exact international lookup, legacy-US compatibility, and kiosk/QR regressions are automated.
