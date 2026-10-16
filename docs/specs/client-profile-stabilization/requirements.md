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

### Profile completion and composition

7. An incomplete profile on mobile MUST show a modal prompting the user to complete their information.
8. The modal CTA MUST open the existing profile form. It MUST NOT introduce a separate persistence path.
9. The modal backdrop MUST use the previously accepted subtle 2 px blur treatment.
10. Student Moments, Analytics, and Gear MUST be removed from `ProfilePageClient` composition on mobile and desktop.
11. Their reusable component files MAY remain for future social-product work.
12. Identity/contact, activity, profile form, packages/summary, coins/history/medals, actions, bookings, calendar, and completion behavior MUST remain available.

### International public-booking phone entry

13. Public booking MUST support United States, Puerto Rico, Argentina, Peru, Mexico, Chile, Ecuador, Brazil, Dominican Republic, Colombia, and Canada.
14. The phone control MUST collect an explicit country and national number and submit valid new numbers only as canonical E.164.
15. Changing country MUST NOT silently reinterpret digits entered for another country.
16. Invalid/incomplete numbers MUST be rejected before identity, checkout, or persistence calls.
17. Existing phone ownership verification, Clerk session activation, rate limits, and non-disclosure rules MUST remain authoritative.
18. Ambiguous legacy phone matches MUST fail closed rather than selecting an identity.
19. Production rollout MUST require Clerk SMS country configuration matching the approved list.

### Profile information wizard

20. The wizard MUST reorganize the existing `ProfileFormState`, validation, completion calculation, and `PUT /api/profile` contract; it MUST NOT create a parallel form or API.
21. Existing saved values MUST prefill their corresponding steps.
22. Invalid step data MUST not be lost or persisted silently.
23. Final completion MUST use the existing profile save behavior and refresh the canonical profile state.
24. Step grouping, navigation, save timing, resume behavior, and viewport scope require a focused product decision before wizard implementation.

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
- [ ] An empty profile booking state does not show a fabricated next class.
- [ ] Mobile incomplete profiles show the completion modal and its CTA opens the existing form.
- [ ] Student Moments, Analytics, and Gear are absent from profile composition.
- [ ] Valid representative numbers from all eleven approved countries reach identity and checkout boundaries as E.164.
- [ ] Invalid and ambiguous phone identities fail safely.
- [ ] The wizard preserves existing values and saves through the existing profile API.
- [ ] Focused unit/API/E2E checks, TypeScript, ESLint, independent verification, and Development smoke pass.
