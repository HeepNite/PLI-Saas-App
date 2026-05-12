# Design: School Wizard Stepper

## Technical Approach

Replace the flat scroll-spy School layout (lines ~9,661–12,100 of `StaffUsersAdminClient.tsx`) with a single **`SchoolWizardPanel`** component driven by a **`useSchoolWizard`** hook. The parent keeps owning all ~61 state vars and ~34 callbacks; the panel renders a step nav + step body and the existing JSX is split into pure render guards (no logic changes). Hidden `<input type="file">` elements stay always-mounted in the parent, outside the wizard subtree, so refs survive step transitions. Approach C from the exploration. Zero API changes.

## Architecture Decisions

| Decision | Choice | Alternative rejected | Rationale |
|---|---|---|---|
| State ownership | Parent keeps state, passes as props | Lift to context/reducer | Avoids 61-var refactor; isolates risk to UI layer only |
| Wizard navigation | Reuse EnrollModal sliding-window pattern (3 visible steps) | Build new nav primitive | Pattern is proven in this codebase; keeps visual consistency |
| Conditional steps | Each step config has `enabled(ctx)` predicate; nav skips/disables | Hard-code `if courseEditingSlug` everywhere | Declarative + testable; works for `courseEditingSlug` (Step 5) and future cases |
| File input refs | Hidden inputs stay in parent JSX outside `<SchoolWizardPanel>` | Move into Media step body | Step unmount would null the ref; this preserves upload flow |
| Save trigger | Single persistent "Save" in panel header — calls existing entity handler (`saveCourseCatalog` \| `savePackagePlan` \| `savePointsRule`) | Save only on last step | Users edit non-linearly; matches current single-form-submit semantics |
| Form boundary | Keep `<form onSubmit={save…}>` wrapping each entity wizard body | Convert to controlled non-form save | Preserves browser validation + Enter-key submit behavior |
| Step component split | Inline render functions per step, not separate files | One file per step | Steps are render-only views over parent state; extra files = more prop plumbing for no win |

## Data Flow

```
StaffUsersAdminClient (owns all school state + callbacks + file refs)
  │
  ├── hidden <input type=file> ×2 (always mounted)
  │
  └── <SchoolWizardPanel {...schoolProps}>
        │
        ├── useSchoolWizard()  → { activeEntity, step, setStep, goToEntity, isStepEnabled }
        │
        ├── <SchoolWizardEntityTabs>     (Courses | Packages | Points)
        ├── <SchoolWizardStepNav>        (sliding-window, EnrollModal pattern)
        ├── header Save button           → calls onSave[activeEntity]
        └── <form onSubmit={onSave[activeEntity]}>
              {STEP_CONFIGS[activeEntity].map(s => step===i && s.render(props))}
```

## File Changes

| File | Action | Description |
|---|---|---|
| `components/front/staff/school/useSchoolWizard.ts` | Create | Hook owning `{activeEntity, step, goToEntity, setStep, isStepEnabled}`. Resets `step=0` on entity change. |
| `components/front/staff/school/SchoolWizardPanel.tsx` | Create | Container: tabs + nav + form + step body. Receives all school props. |
| `components/front/staff/school/SchoolWizardStepNav.tsx` | Create | Sliding-window nav (max 3 visible) ported from `EnrollModal.tsx` lines 2480–2540. |
| `components/front/staff/school/stepConfigs.tsx` | Create | `STEP_CONFIGS: Record<EntityKey, StepConfig[]>`. Each step has `{key, label, Icon, enabled?, render(props)}`. Render fns return existing JSX blocks verbatim. |
| `components/front/staff/school/types.ts` | Create | `SchoolWizardEntity`, `StepConfig`, `SchoolWizardPanelProps` (grouped sub-interfaces). |
| `components/front/staff/StaffUsersAdminClient.tsx` | Modify | Replace lines ~9,661–12,100 wizard sub-section with `<SchoolWizardPanel {...} />`. Move JSX blocks into `stepConfigs.tsx` render fns. Keep hidden file inputs in parent. Remove `SCHOOL_FLOW_STEPS`, `activeSchoolFlowStep`, `schoolSectionRefs`. |

Static listings (Courses list, Packages grid, Points rules table) stay below the panel as plain JSX in the parent — already always-visible in current layout.

## Interfaces / Contracts

```ts
// useSchoolWizard.ts
export type SchoolWizardEntity = "courses" | "packages" | "points"
export interface SchoolWizardState {
  activeEntity: SchoolWizardEntity
  step: number
  setStep: (n: number) => void
  goToEntity: (e: SchoolWizardEntity) => void  // resets step to 0
  isStepEnabled: (entity: SchoolWizardEntity, index: number, ctx: StepEnableCtx) => boolean
}
export interface StepEnableCtx {
  courseEditingSlug: string | null
  // future: isSpecialEventCourse, etc.
}

// stepConfigs.tsx
export interface StepConfig<P> {
  key: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  enabled?: (ctx: StepEnableCtx) => boolean   // default: true
  render: (props: P) => React.ReactNode
}

// SchoolWizardPanel.tsx — props grouped to keep call site readable
export interface SchoolWizardPanelProps {
  // shared
  schoolError: string | null
  schoolSuccess: string | null
  // courses bundle
  courses: CoursesWizardProps   // form, schedule, links, media handlers, refs-by-callback
  // packages bundle
  packages: PackagesWizardProps
  // points bundle
  points: PointsWizardProps
  // save handlers (one per entity)
  onSaveCourse: (e: React.FormEvent) => void
  onSavePackage: (e: React.FormEvent) => void
  onSavePointsRule: (e: React.FormEvent) => void
  onAssignPointsManually: (e: React.FormEvent) => void
}
```

`CoursesWizardProps`, `PackagesWizardProps`, `PointsWizardProps` are sub-interfaces grouping the existing parent state slices and callbacks (1:1 with current usages — no renames). Documented with JSDoc; this is the honest cost of keeping state in the parent.

Step-5 gate: `STEP_CONFIGS.courses[4].enabled = (ctx) => Boolean(ctx.courseEditingSlug)`. Nav disables/skips it for new courses; the render guard inside the form body short-circuits to nothing.

Save button click calls `formRef.current?.requestSubmit()` so the existing form `onSubmit` runs unchanged.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `useSchoolWizard` reducer (entity change resets step, `isStepEnabled` for `courseEditingSlug`) | RTL `renderHook` |
| Unit | `STEP_CONFIGS` shape (correct counts: 7/4/2; keys unique per entity) | Plain assertions |
| Component | `SchoolWizardStepNav` sliding window with 7 steps at index 0/3/6 | RTL render + snapshot of visible labels |
| Integration | Mount `SchoolWizardPanel` with mock props; verify Step 5 hidden when `courseEditingSlug=null`; Save button triggers `onSaveCourse` | RTL + `userEvent` |
| Regression | Existing `StaffUsersAdminClient.test.ts` helpers (slug normalization, schedule parsing) | Run unchanged |

## Migration / Rollout

No data migration. Single PR. Rollback = revert the file diff (one render-call swap + one folder add). Feature flag not required — UI-only swap, no API surface.

## Open Questions

- [ ] Points wizard: confirm 2 steps (Rule Builder, Manual Assignment) is the final shape — exploration left this TBD.
- [ ] Should "Save" auto-advance to next step on success, or stay on current step? Default: stay (matches today).
