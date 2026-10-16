# Client Profile Stabilization — Resolved Decisions

## Decisions

| Topic | Decision |
| --- | --- |
| Delivery base | Rebuild on current `origin/codex/develop`; do not merge stale feature branches wholesale. |
| Business timezone | `America/New_York` owns class wall-clock interpretation, date keys, grouping, and display. |
| API timestamp format | Keep ISO UTC instants at API boundaries. Correct the instant when constructing it, not by offsetting display text. |
| Booked-class presentation | Show all returned future scheduled bookings in the calendar and scheduled-class area; never fabricate a next class. |
| Profile prompt | Restore the verified mobile incomplete-profile modal and 2 px backdrop blur; CTA opens the existing form. |
| Removed sections | Unmount Student Moments, Analytics, and Gear from mobile and desktop; retain reusable source files. |
| Phone countries | Allow only US, PR, AR, PE, MX, CL, EC, BR, DO, CO, and CA in this release. |
| Phone storage/boundary | New valid values cross identity, checkout, and persistence boundaries as E.164. |
| Legacy identity | Resolve only an unambiguous user; ambiguous countryless legacy matches fail closed. |
| Wizard architecture | Reuse `ProfileFormState`, `useProfileForm`, completion logic, and `PUT /api/profile`; presentation only. |
| Test fixture | Keep the authorized Development booking until integrated verification, then remove its attendance/session/purchase artifacts. |
| Production | Out of scope until Development is green and the user explicitly authorizes promotion. |

## Conflicts reconciled

- A UTC ISO timestamp is still the correct transport format; the defect is treating a New York wall-clock input as host-local time.
- Profile-origin checkout may redeem an already delivered Heritage benefit, but profile origin does not acquire a new pin. This work must preserve that distinction.
- International-phone historical code is reference material. Only behavior compatible with current booking and identity contracts will be ported.
- Removing profile sections means removing composition, not deleting future reusable components.

## Open wizard decisions

Before T5 source implementation, resolve in one decision round:

1. Field grouping and step order.
2. Linear-only versus skippable navigation.
3. Save only at the end versus explicit per-step draft save.
4. Whether closing resumes the previous step.
5. Mobile-only versus responsive wizard on all viewports.
