# Tasks: School Wizard Stepper

## Phase 1: Foundation / Infrastructure

- [ ] 1.1 Create `components/front/staff/school/types.ts` with SchoolWizardEntity, StepConfig interfaces, and SchoolWizardPanelProps grouped sub-interfaces
- [ ] 1.2 Create `components/front/staff/school/useSchoolWizard.ts` hook with activeEntity, step, setStep, goToEntity, isStepEnabled state logic  
- [ ] 1.3 Create `components/front/staff/school/stepConfigs.tsx` with STEP_CONFIGS record containing all render functions for each entity wizard step
- [ ] 1.4 Add conditional `enabled(ctx)` predicate to Course Links step (step 5) that returns `Boolean(ctx.courseEditingSlug)`

## Phase 2: Core Components

- [ ] 2.1 Create `components/front/staff/school/SchoolWizardStepNav.tsx` porting sliding-window pattern from EnrollModal.tsx lines 2480–2540
- [ ] 2.2 Create `components/front/staff/school/SchoolWizardPanel.tsx` container component with tabs, nav, form boundary, and step body rendering
- [ ] 2.3 Implement course wizard 7 steps: Main Info, Prices, Media, Schedule, Course Links, Preview, Publish in stepConfigs render functions
- [ ] 2.4 Implement package wizard 4 steps: Main Info, Assign Courses, Pricing & Credits, Valid Days & Status in stepConfigs render functions
- [ ] 2.5 Implement points wizard 2 steps: Rule Builder, Manual Assignment in stepConfigs render functions

## Phase 3: Integration / Wiring  

- [ ] 3.1 Replace lines ~9,661–12,100 in StaffUsersAdminClient.tsx with `<SchoolWizardPanel {...props} />` call
- [ ] 3.2 Remove SCHOOL_FLOW_STEPS, activeSchoolFlowStep, schoolSectionRefs from StaffUsersAdminClient.tsx state
- [ ] 3.3 Keep hidden file inputs (`courseImageInputRef`, `courseVideoInputRef`) always-mounted in parent DOM outside wizard subtree
- [ ] 3.4 Add persistent Save button in wizard header that calls `formRef.current?.requestSubmit()` to trigger existing save handlers
- [ ] 3.5 Wire existing save handlers: saveCourseCatalog, savePackagePlan, savePointsRule, assignPointsManually to wizard form submissions

## Phase 4: Testing

- [ ] 4.1 Write unit tests for useSchoolWizard hook state transitions and isStepEnabled logic
- [ ] 4.2 Write unit tests for STEP_CONFIGS structure and conditional Course Links step predicate  
- [ ] 4.3 Write component tests for SchoolWizardStepNav sliding window behavior with 3-visible pattern
- [ ] 4.4 Write integration test verifying Course Links step is disabled/hidden when courseEditingSlug is null
- [ ] 4.5 Write integration test verifying Save button triggers correct handler per active entity wizard
- [ ] 4.6 Write integration test verifying static listings remain visible below wizard panel
- [ ] 4.7 Run existing StaffUsersAdminClient.test.ts helper tests to ensure no regressions