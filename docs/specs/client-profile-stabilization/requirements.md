# Client Profile Stabilization — Requirements

## Status

Accepted for implementation on `codex/develop`.

## Outcome

The client profile must accurately show and manage booked classes, guide incomplete profiles through a clearer data-entry experience, and preserve international customers throughout public booking without changing the existing auth, payment, package, or profile persistence models.

## Functional requirements

### Booking time and calendar

1. Class date and time are New York wall-clock values. Every server conversion to an instant MUST use `America/New_York`, including daylight-saving transitions.
2. APIs MUST continue returning timestamps as ISO UTC instants.
3. Profile formatting, month membership, day grouping, assignment, and rescheduling MUST derive from the same New York instant contract.
4. Every future scheduled booking returned by `/api/profile/bookings` MUST appear in the profile calendar and scheduled-class presentation.
5. The calendar MUST distinguish existing bookings from pending changes and MUST NOT invent a default next class when none exists.
6. Assignment and rescheduling MUST continue validating catalog schedules, ownership, package availability, duplicate bookings, capacity, and past slots on the server.
7. Public web booking MUST remain a scheduled web flow even when it reuses the compact QR-shaped enrollment UI. It MUST NOT be persisted or fulfilled as kiosk check-in.
8. Public web purchases MUST be attributed to the server-owned `public_booking` channel, create future `scheduled` attendance, and remain visible through `/api/profile/bookings`.
9. A signed-in public customer without an applicable package MUST fall through to regular checkout after validating the slot against the same authoritative catalog used by the weekday page.

### Profile completion and composition

10. An incomplete profile on mobile MUST show a modal prompting the user to complete their information.
11. The modal CTA MUST open the existing profile form. It MUST NOT introduce a separate persistence path.
12. The modal backdrop MUST use the previously accepted subtle 2 px blur treatment.
13. Student Moments, Analytics, and Gear MUST be removed from `ProfilePageClient` composition on mobile and desktop.
14. Their reusable component files MAY remain for future social-product work.
15. Identity/contact, activity, profile form, packages/summary, coins/history/medals, actions, bookings, calendar, and completion behavior MUST remain available.

### International public-booking phone entry

16. Public booking MUST support United States, Puerto Rico, Argentina, Peru, Mexico, Chile, Ecuador, Brazil, Dominican Republic, Colombia, and Canada.
17. The phone control MUST collect an explicit country and national number and submit valid new numbers only as canonical E.164.
18. Changing country MUST NOT silently reinterpret digits entered for another country.
19. Invalid/incomplete numbers MUST be rejected before identity, checkout, or persistence calls.
20. Existing phone ownership verification, Clerk session activation, rate limits, and non-disclosure rules MUST remain authoritative.
21. Ambiguous legacy phone matches MUST fail closed rather than selecting an identity.
22. Production rollout MUST require Clerk SMS country configuration matching the approved list.

### Profile information wizard

23. The wizard MUST reorganize the existing `ProfileFormState`, validation, completion calculation, and `PUT /api/profile` contract; it MUST NOT create a parallel form or API.
24. Existing saved values MUST prefill their corresponding steps.
25. Invalid step data MUST not be lost or persisted silently.
26. Final completion MUST use the existing profile save behavior and refresh the canonical profile state.
27. Step grouping, navigation, save timing, resume behavior, and viewport scope require a focused product decision before wizard implementation.

## Non-goals

- Database schema changes for the profile wizard.
- New booking, package, Clerk, or payment endpoints when current contracts can be reused.
- Restoring social/profile sections removed from composition.
- Unrestricted worldwide phone support.
- Merging stale profile or international-phone branches wholesale.
- Production delivery before Development validation and explicit authorization.

## Acceptance criteria

- [ ] A class sold as 7:00 PM New York is displayed as 7:00 PM New York in the profile.
- [ ] Booked classes visibly appear on the appropriate profile calendar day.
- [ ] Public web checkout creates a web-attributed future scheduled booking, not a kiosk check-in.
- [ ] Signed-in public customers without package credits can continue to regular checkout for a catalog-advertised slot.
- [ ] An empty profile booking state does not show a fabricated next class.
- [ ] Mobile incomplete profiles show the completion modal and its CTA opens the existing form.
- [ ] Student Moments, Analytics, and Gear are absent from profile composition.
- [ ] Valid representative numbers from all eleven approved countries reach identity and checkout boundaries as E.164.
- [ ] Invalid and ambiguous phone identities fail safely.
- [ ] The wizard preserves existing values and saves through the existing profile API.
- [ ] Focused unit/API/E2E checks, TypeScript, ESLint, independent verification, and Development smoke pass.
