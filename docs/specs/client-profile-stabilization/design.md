# Client Profile Stabilization — Design

## Architecture summary

Correct shared domain boundaries first, then change presentation. Keep one source of truth for each concern:

- New York wall-clock conversion: shared schedule helper.
- Booking truth: `/api/profile/bookings` and server assignment/reschedule validation.
- Calendar projection: profile agenda hook plus assignment card.
- Profile data: existing form state/hook/API.
- Phone truth: shared phone domain, explicit country, canonical E.164.

## Work units

### 1. New York timestamps and booked calendar

1. Add failing tests for winter/summer New York wall-clock conversion and the reproduced 7:00 PM case.
2. Replace host-local construction with an explicit New York wall-clock-to-instant conversion.
3. Reuse the corrected helper in assignment, reschedule, and public package booking callers.
4. Derive agenda month/day keys in New York.
5. Render existing and pending events in the assignment calendar/scheduled-class presentation.
6. Remove static fallback next-class copy.

### 2. Completion prompt and simplified composition

1. Port the accepted modal behavior into a current component with native dialog semantics.
2. Gate it on loaded, mobile, incomplete profile state.
3. Route its CTA to the existing profile form owner.
4. Remove Student Moments, Analytics, and Gear imports, exclusive calculations, and composition only.
5. Preserve core profile sections and reusable component files.

### 3. International public-booking phone

1. Centralize the eleven-country allowlist in the shared phone domain.
2. Add explicit country/national-input state to public enrollment contact handling.
3. Reuse or adapt the existing international phone field without importing kiosk-only behavior.
4. Convert to E.164 before verification, Clerk, checkout, recovery, or persistence calls.
5. Keep server validation authoritative and identity matching ambiguity-safe.
6. Add rollout evidence for Clerk Development SMS support; Production remains separately gated.

### 4. Profile information wizard

After the open product decisions are resolved:

1. Extract step configuration over existing `ProfileFormState` fields.
2. Keep `useProfileForm` as the sole data/state owner.
3. Render step-local subsets of the existing controls.
4. Apply existing validation and final save contract.
5. Preserve edit-prefill and canonical profile refresh.

## Rollback boundaries

Each work unit ships as its own reviewable commit/PR slice:

- Revert timestamp/calendar changes independently.
- Revert profile composition/modal independently.
- Revert international phone wiring while retaining safe shared parsing where already consumed.
- Revert wizard presentation to the existing flat `ProfileFormCard` without API/data rollback.

## Verification strategy

| Unit | Deterministic checks | Runtime checks |
| --- | --- | --- |
| Time/calendar | helper, API, hook, component tests; TypeScript; ESLint | Development fixture displays the selected 7:00 PM and visible calendar event |
| Prompt/composition | modal and profile composition tests | 390 px incomplete/complete profile smoke plus desktop absence check |
| Phone | all-country parser/UI/verification/checkout tests | Development Clerk test-number smoke for representative NANP and non-NANP countries |
| Wizard | navigation, validation, persistence and profile E2E | Mobile and desktop walkthrough |
| Integrated | focused suites plus applicable full suite and independent verifier | clean Development smoke, then fixture cleanup |
