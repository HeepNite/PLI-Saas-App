# Proposal: School Wizard Stepper

## Intent

Replace the flat scroll-spy School section with a **tabbed wizard panel** at the top and **static listings** always visible below. Current UX forces staff to scroll through a 2,290-line JSX wall to manage courses, packages, and points. The wizard restructures the same state into guided steps without touching the API layer or extracting monolith state.

## Scope

### In Scope
- New `SchoolWizardPanel` component receiving all school state as props
- New `useSchoolWizard` hook: `{ activeEntity, step, setStep, goToEntity }`
- New `SchoolWizardStepNav` component (sliding-window pattern from `EnrollModal`)
- Course wizard: 7 steps (Main Info → Prices → Media → Schedule → Course Links → Preview & Calendar → Publish)
- Package wizard: 4 steps (Main Info → Assign Courses → Pricing & Credits → Valid Days & Status)
- Points stepper: 2 steps (Rule Builder → Manual Assignment)
- Persistent **Save** button in wizard header (available at every step)
- Static listings always rendered below wizard: Courses list, Packages list, Points list
- Step 5 (Course Links) conditionally disabled when `courseEditingSlug` is falsy (new course)
- Hidden file inputs (`courseImageInputRef`, `courseVideoInputRef`) always-mounted outside step content

### Out of Scope
- Extracting 61+ state variables from `StaffUsersAdminClient.tsx` to a context/reducer
- Breaking changes to any API endpoint or payload
- New database schema changes
- Per-step auto-save / draft persistence (deferred)
- Mobile-optimized wizard layout (deferred)

### Future
- Extract state to `SchoolContext` or a Zustand slice (full monolith decomposition)
- Per-step partial save with optimistic UI
- Keyboard shortcut navigation between steps

## Capabilities

### New Capabilities
- `school-wizard-stepper`: Tabbed wizard panel for managing Courses, Packages, and Points in the staff School section, with step navigation and always-visible static listings below.

### Modified Capabilities
- None

## Approach

**Approach C — Hybrid: New Component + Hook, No State Migration**

1. `useSchoolWizard` hook → owns `activeEntity` + `step` only; exposed as `{ activeEntity, step, setStep, goToEntity }`
2. `SchoolWizardStepNav` → sliding-window 3-tab nav, replicates `EnrollModal` pattern exactly
3. `SchoolWizardPanel` → receives ALL 61+ school state vars as props; renders step-nav + conditional step content; no business logic
4. Parent (`StaffUsersAdminClient`) calls `useSchoolWizard`, passes wizard state + all existing state down into `SchoolWizardPanel`
5. Hidden file `<input>` elements rendered in parent DOM, outside panel, always-mounted
6. Static listings (courses, packages, points tables) rendered below `SchoolWizardPanel`, always in DOM

Zero API changes. Zero test regressions (existing tests target pure helpers, not component render).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/staff/StaffUsersAdminClient.tsx` | Modified | Replace scroll-spy nav with `useSchoolWizard`; render `SchoolWizardPanel`; keep state vars in place |
| `components/front/staff/school/SchoolWizardPanel.tsx` | New | Main wizard container; tab switcher + step renderer |
| `components/front/staff/school/SchoolWizardStepNav.tsx` | New | Sliding-window step navigator (3-visible pattern) |
| `hooks/useSchoolWizard.ts` | New | `activeEntity` + `step` state; navigation helpers |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hidden file inputs break when Media step unmounts | Med | Keep both `<input type="file">` rendered in parent, pass refs down |
| Step 5 (Course Links) shown for new courses | Low | Guard: `step === 4 && !courseEditingSlug` → skip or disable step |
| Form submit fires from wrong step | Low | Persistent Save button in header calls same `saveCourseCatalog`; no step-boundary form wrapping |
| Prop surface on `SchoolWizardPanel` too large (~61 props) | Med | Accept as honest cost; document with JSDoc grouping; future migration to context is separate change |
| `isSpecialEventCourse` changes Schedule step label | Low | Pass flag as prop; step label computed inside `SchoolWizardPanel` |

## Rollback Plan

The original scroll-spy nav (`activeSchoolFlowStep`, `schoolSectionRefs`, `scrollIntoView`) remains untouched until the wizard is live and verified. Rollback = revert the `SchoolWizardPanel` render call in the parent and restore the original JSX block (git revert one commit).

## Dependencies

- No new libraries required — stepper pattern reuses existing `EnrollModal` implementation
- `EnrollModal` component available as reference at build time

## Success Criteria

- [ ] Staff can switch between Courses / Packages / Points tabs without page reload or scroll
- [ ] Each wizard entity has correct number of steps rendered (7 / 4 / 2)
- [ ] Step 5 (Course Links) is absent/disabled when creating a new course
- [ ] Media uploads work on step 3 (`courseImageInputRef`, `courseVideoInputRef` functional)
- [ ] Save button visible and functional at every step for all three entities
- [ ] Static listings (courses, packages, points) always visible below wizard
- [ ] Zero regressions to existing test suite (`npm run test` green)
- [ ] Zero API contract changes (verified by existing API integration tests)
