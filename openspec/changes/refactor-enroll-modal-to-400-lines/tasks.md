# Tasks: Refactor EnrollModal to 400-Line Orchestrator

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,370 additions + ~3,100 deletions from EnrollModal = ~4,470 raw; net diff per PR ≤ 400 |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR1a → PR1b → PR2 → PR3 → PR4a → PR4b → PR5 (7 PRs, feature-branch chain) |
| Delivery strategy | ask-always (interactive preflight) |
| Chain strategy | feature-branch-chain |

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

> **STOP GATE**: Before running `sdd-apply` for any slice, confirm the diff of
> that slice is ≤ 400 changed lines against that slice's actual base branch
> (for example: PR1a vs `origin/codex/develop`, PR1b vs PR1a branch, PR2 vs
> PR1b branch). Do **not** measure PR2+ cumulatively against `origin/codex/develop`.
> If a slice exceeds budget after tests are included, split that slice further
> before opening a PR.
> **Target branch**: `codex/develop` — NEVER `main`.
> Fresh review required after each slice merges.

### Suggested Work Units

| Unit | Goal | Likely PR | Base Branch | Budget Rule |
|------|------|-----------|-------------|-------------|
| Slice 1a | Pure `stepValid` extraction + tests | PR 1a | `codex/develop` | ~180 raw / ≤400 budget |
| Slice 1b | Type-only props extraction | PR 1b | PR 1a branch | ~180 raw / ≤400 budget |
| Slice 2 | Init + consecutive offer hooks | PR 2 | PR 1b branch | ≤400 including tests; split into 2a/2b if exceeded |
| Slice 3 | Kiosk inactivity + QR poller hooks | PR 3 | PR 2 branch | ≤400 including tests; split into 3a/3b if exceeded |
| Slice 4a | Sidebar + overlays sub-components | PR 4a | PR 3 branch | ≤400 including tests |
| Slice 4b | StepRouter sub-component | PR 4b | PR 4a branch | ≤400 including tests |
| Slice 5 | Orchestrator trim to ≤ 400 lines | PR 5 | PR 4b branch | ≤400 including verification updates |

---

## Phase 1 — Slices 1a/1b: Prerequisite `stepValid` + Types

> **Dependency**: Nothing. All later slices depend on this landing first.
> **Target PRs**: PR 1a → `codex/develop`, then PR 1b → PR 1a branch.
> **Split decision**: The original combined Slice 1 exceeded its optimistic
> 150-line estimate once tests and type-only props were counted. Split into
> two review units while preserving the project-wide ≤400 changed-line budget.

- [x] 1a.1 Create `components/front/courses/enroll/model/enroll-step-valid.ts` — extract `StepValidContext` type and pure `resolveStepValid(stepIndex: number, ctx: StepValidContext): boolean` function from the inline closure at `EnrollModal.tsx` line ~2125.
- [x] 1a.2 Modify `EnrollModal.tsx` — replace only the inline `stepValid` closure with an import from `enroll-step-valid.ts`; keep type declarations inline until Slice 1b.
- [x] 1a.3 Write unit tests for `resolveStepValid` in `tests/checkin/enroll-step-valid.test.ts` — cover all 8+ `stepKey` branches with boundary values; zero React dependency.
- [x] 1b.1 Create `components/front/courses/enroll/types/enroll-modal-props.ts` — extract `EnrollFlowVariant`, `EnrollCompletionMode`, `EnrollCheckInContext`, `EnrollPrefillSelection`, `PreparedAccountState`, `NewStudentVerifyResponse`, `FlowPopupState`, and the full `EnrollModalProps` type from `EnrollModal.tsx`.
- [x] 1b.2 Modify `EnrollModal.tsx` — replace inlined type declarations with imports from `enroll-modal-props.ts`; delete duplicate inline type definitions.

### Acceptance Criteria — Slice 1a

- `enroll-step-valid.ts` is a pure TS module with no React imports.
- `EnrollModal.tsx` imports `resolveStepValid`; no duplicate `stepValid` switch remains inline.
- All `resolveStepValid` branches covered by unit tests.
- `tsc --noEmit` — zero new errors.
- focused `vitest run tests/checkin/enroll-step-valid.test.ts` — green.
- `eslint` — zero new errors.
- Diff ≤ 400 changed lines.

### Acceptance Criteria — Slice 1b

- `enroll-modal-props.ts` has no runtime code — types only.
- `EnrollModal.tsx` imports `EnrollModalProps` and retained supporting types; no duplicate extracted type definitions remain inline.
- `tsc --noEmit` — zero new errors.
- `eslint` — zero new errors.
- Diff ≤ 400 changed lines.

### Verification Commands — Slice 1a

```bash
npx tsc --noEmit
npx vitest run tests/checkin/enroll-step-valid.test.ts
npx eslint components/front/courses/enroll/model/enroll-step-valid.ts tests/checkin/enroll-step-valid.test.ts components/front/courses/EnrollModal.tsx
wc -l components/front/courses/EnrollModal.tsx
git diff --stat <slice-base-branch>
```

### Verification Commands — Slice 1b

```bash
npx tsc --noEmit
npx eslint components/front/courses/enroll/types/enroll-modal-props.ts components/front/courses/EnrollModal.tsx
wc -l components/front/courses/EnrollModal.tsx
git diff --stat <slice-base-branch>
```

### Rollback — Slices 1a/1b

```bash
git revert <PR1b-merge-commit>
git revert <PR1a-merge-commit>
# EnrollModal re-inlines types and stepValid closure. No side effects.
```

---

## Phase 2 — Slice 2: Init + Consecutive Offer Hooks

> **Dependency**: Slices 1a and 1b merged.
> **Target PR**: PR 2 → PR 1b branch (rebased on `codex/develop` after PR 1b merges).

- [ ] 2.1 Create `components/front/courses/enroll/hooks/useEnrollInit.ts` — extract the `open`-triggered initialization effect and `resetForm` callback from `EnrollModal.tsx` using the exact signature specified in `design.md` (~180 lines).
- [ ] 2.2 Create `components/front/courses/enroll/hooks/useConsecutiveOffer.ts` — extract consecutive-offer fetch effect with abort controller using the exact signature specified in `design.md` (~80 lines).
- [ ] 2.3 Modify `EnrollModal.tsx` — replace extracted initialization effects and consecutive-offer effect with `useEnrollInit(...)` and `useConsecutiveOffer(...)` calls; preserve exact dependency arrays (~90 lines net change).
- [ ] 2.4 Write `useConsecutiveOffer.test.ts` — `renderHook` + `msw`; assert fetch fires on date/time change, aborts on cleanup, resets when `consecutiveOffer` prop provided.
- [ ] 2.5 Write `useEnrollInit.test.ts` — mock sessionStorage + dispatch; assert correct initial field values dispatched on `open` flip for kiosk, check-in, and default paths.

### Acceptance Criteria — Slice 2

- `useEnrollInit` and `useConsecutiveOffer` are in `enroll/hooks/`; each is independently importable.
- `EnrollModal.tsx` has no remaining inline initialization effects covered by these hooks.
- Dependency arrays in extracted hooks are identical to what was inlined.
- `react-hooks/exhaustive-deps` lint rule stays clean on both new hooks.
- `ConsecutiveOfferData` import remains from `checkin/ConsecutiveClassOffer.tsx` (NOT moved — deferred per design decision).
- All 10+ booking paths manually smoke-tested after PR 2 merges.
- `tsc --noEmit`, `vitest run`, `eslint` — zero new errors/violations.
- Diff ≤ 400 changed lines including tests; split into 2a/2b if exceeded.

### Verification Commands — Slice 2

```bash
npx tsc --noEmit
npx vitest run
npx eslint components/front/courses/enroll/hooks/useEnrollInit.ts components/front/courses/enroll/hooks/useConsecutiveOffer.ts
wc -l components/front/courses/EnrollModal.tsx
git diff --stat <pr1b-branch>
```

### Rollback — Slice 2

```bash
git revert <PR2-merge-commit>
# PR1a + PR1b state remains valid. EnrollModal re-inlines init and consecutive effects.
```

---

## Phase 3 — Slice 3: Kiosk Hooks (Inactivity + QR Poller)

> **Dependency**: Slice 2 merged.
> **Target PR**: PR 3 → PR 2 branch.

- [ ] 3.1 Create `components/front/courses/enroll/hooks/useKioskInactivity.ts` — extract station-completion timeout and kiosk inactivity controller wiring using the exact signature from `design.md` (~110 lines).
- [ ] 3.2 Create `components/front/courses/enroll/hooks/useKioskQrPoller.ts` — extract `createKioskQrPoller` lifecycle (start/stop/outcome dispatch) using the exact signature from `design.md` (~90 lines).
- [ ] 3.3 Modify `EnrollModal.tsx` — replace extracted kiosk effects with `useKioskInactivity(...)` and `useKioskQrPoller(...)` calls; preserve exact dependency arrays (~80 lines net change).
- [ ] 3.4 Write `useKioskInactivity.test.ts` — fake timers; assert `onTimeoutAction` fires after inactivity window, resets on activity events, pauses during QR phase.
- [ ] 3.5 Write `useKioskQrPoller.test.ts` — mock `createKioskQrPoller`; assert poller started when `kioskQrCheckoutPending = true` and stopped on cleanup.

### Acceptance Criteria — Slice 3

- `useKioskInactivity` and `useKioskQrPoller` are in `enroll/hooks/`; each is independently importable.
- `EnrollModal.tsx` no longer contains inline kiosk timer or QR poller logic.
- `react-hooks/exhaustive-deps` stays clean on both new hooks.
- Kiosk terminal and QR/card/cash paths manually smoke-tested.
- `tsc --noEmit`, `vitest run`, `eslint` — zero new errors/violations.
- Diff ≤ 400 changed lines including tests; split into 3a/3b if exceeded.

### Verification Commands — Slice 3

```bash
npx tsc --noEmit
npx vitest run
npx eslint components/front/courses/enroll/hooks/useKioskInactivity.ts components/front/courses/enroll/hooks/useKioskQrPoller.ts
wc -l components/front/courses/EnrollModal.tsx
git diff --stat <pr2-branch>
```

### Rollback — Slice 3

```bash
git revert <PR3-merge-commit>
# PR1a + PR1b + PR2 state remains valid. EnrollModal re-inlines kiosk timer/QR logic.
```

---

## Phase 4a — Slice 4a: Sidebar + Overlays Sub-components

> **Dependency**: Slice 3 merged.
> **Target PR**: PR 4a → PR 3 branch.
> **Note**: Slice 4 split into 4a + 4b to respect 400-line review budget.

- [ ] 4a.1 Create `components/front/courses/enroll/steps/EnrollSidebar.tsx` — extract left aside: step breadcrumb nav (consuming `resolveStepValid` from `enroll-step-valid.ts`), booking summary, calendar links (success state); use explicit flat props per design data flow (~160 lines).
- [ ] 4a.2 Create `components/front/courses/enroll/steps/EnrollSignInOverlay.tsx` — extract `requiresSignIn` overlay: sign-in copy, `EmbeddedSignIn`, dismiss callback; orchestrator retains sign-in state ownership (~50 lines).
- [ ] 4a.3 Create `components/front/courses/enroll/steps/EnrollFlowPopup.tsx` — extract `flowPopup` modal: title, message, Continue button; orchestrator retains popup state ownership (~30 lines).
- [ ] 4a.4 Modify `EnrollModal.tsx` — replace inline JSX for sidebar, sign-in overlay, and flow popup with `<EnrollSidebar ...>`, `<EnrollSignInOverlay ...>`, `<EnrollFlowPopup ...>` calls.
- [ ] 4a.5 Write RTL snapshot test for `EnrollSidebar` — assert breadcrumb renders correct active/done states for a given `step` value and `stepValid` mock.
- [ ] 4a.6 Write RTL tests for `EnrollSignInOverlay` and `EnrollFlowPopup` — assert visibility and dismiss callback wiring.

### Acceptance Criteria — Slice 4a

- All three new components are in `enroll/steps/`.
- `EnrollSidebar` imports `resolveStepValid` from `enroll/model/enroll-step-valid.ts` — no duplication.
- Orchestrator retains state ownership for sign-in and popup; sub-components are stateless.
- Props APIs use flat explicit props — no React Context.
- `tsc --noEmit`, `vitest run`, `eslint` — zero new errors/violations.
- Diff ≤ 400 changed lines including tests.

### Verification Commands — Slice 4a

```bash
npx tsc --noEmit
npx vitest run
npx eslint components/front/courses/enroll/steps/EnrollSidebar.tsx components/front/courses/enroll/steps/EnrollSignInOverlay.tsx components/front/courses/enroll/steps/EnrollFlowPopup.tsx
wc -l components/front/courses/EnrollModal.tsx
git diff --stat <pr3-branch>
```

### Rollback — Slice 4a

```bash
git revert <PR4a-merge-commit>
# PR1a + PR1b + PR2 + PR3 state remains valid.
```

---

## Phase 4b — Slice 4b: StepRouter Sub-component

> **Dependency**: Slice 4a merged.
> **Target PR**: PR 4b → PR 4a branch.

- [ ] 4b.1 Create `components/front/courses/enroll/steps/EnrollStepRouter.tsx` — extract the main section `switch`/`if`-on-`activeStepKey` block; render the correct step panel for each booking path (public, profile, check-in new/existing, kiosk, QR/card/cash, PIN/SMS, consecutive offer, photo, draft, calendar, payments); use explicit flat props per design data flow (~160 lines).
- [ ] 4b.2 Modify `EnrollModal.tsx` — replace inline step-routing JSX with `<EnrollStepRouter ...>` call.
- [ ] 4b.3 Write RTL per-step render check for `EnrollStepRouter` — assert each `stepKey` renders its panel without throwing; cover at minimum: `info`, `check-in`, `kiosk`, `photo`, `consecutive`, `payment`.

### Acceptance Criteria — Slice 4b

- `EnrollStepRouter` is in `enroll/steps/`; independently importable.
- `EnrollStepRouter` owns no state mutation or effect firing — pure render.
- All 10+ booking path panels accessible via `EnrollStepRouter` props.
- `tsc --noEmit`, `vitest run`, `eslint` — zero new errors/violations.
- Diff ≤ 400 changed lines including tests.

### Verification Commands — Slice 4b

```bash
npx tsc --noEmit
npx vitest run
npx eslint components/front/courses/enroll/steps/EnrollStepRouter.tsx
wc -l components/front/courses/EnrollModal.tsx
git diff --stat <pr4a-branch>
```

### Rollback — Slice 4b

```bash
git revert <PR4b-merge-commit>
# PR1a + PR1b + PR2 + PR3 + PR4a state remains valid.
```

---

## Phase 5 — Slice 5: Orchestrator Trim to ≤ 400 Lines

> **Dependency**: Slice 4b merged.
> **Target PR**: PR 5 → PR 4b branch. Final merge target: `codex/develop`.

- [ ] 5.1 Audit `EnrollModal.tsx` — identify all remaining dead import lines, inline helpers already in `enroll/model/`, and inline callbacks now owned by extracted hooks (~20 minutes read pass).
- [ ] 5.2 Modify `EnrollModal.tsx` — remove dead imports; remove any inline helpers/callbacks duplicated in extracted modules; ensure exported re-exports `formatCheckInSummaryDateTime` and `computeCheckInAutofill` remain exported from `EnrollModal.tsx` (~200 lines removed).
- [ ] 5.3 Assert `EnrollModal.tsx` line count ≤ 400 — run `wc -l`; if above 400, identify remaining extractable blocks and continue trimming before opening PR 5.
- [ ] 5.4 Run full smoke-test checklist manually: public booking, profile booking, check-in new/existing, kiosk terminal, QR/card/cash, PIN/SMS, consecutive offer, photo, draft, calendar, payments — verify zero regressions.
- [ ] 5.5 Run full toolchain gate: `tsc --noEmit`, `vitest run`, `eslint` — assert zero new errors/violations.

### Acceptance Criteria — Slice 5

- `wc -l components/front/courses/EnrollModal.tsx` ≤ 400.
- `EnrollModal.tsx` public export surface (props interface) unchanged.
- `formatCheckInSummaryDateTime` and `computeCheckInAutofill` still exported from `EnrollModal.tsx`.
- No new `useEffect` / `useCallback` / `useMemo` added beyond what existed inline before this change.
- All 10+ booking paths manually verified green.
- `tsc --noEmit`, `vitest run`, `eslint` — zero new errors/violations.
- Diff ≤ 400 changed lines including verification updates.
- PR 5 targets `codex/develop` — NOT `main`.

### Verification Commands — Slice 5

```bash
wc -l components/front/courses/EnrollModal.tsx
npx tsc --noEmit
npx vitest run
npx eslint components/front/courses/EnrollModal.tsx
git diff --stat <pr4b-branch>
# Confirm no main target:
git log --oneline codex/develop..HEAD
```

### Rollback — Slice 5

```bash
git revert <PR5-merge-commit>
# PR4b state: EnrollModal is a ≤ 800-line orchestrator — fully valid working state.
# No database or API changes to rollback.
# Re-run: tsc --noEmit && vitest run to confirm green.
```

---

## Global Gates (apply to all slices)

| Gate | Check |
|------|-------|
| Budget gate | `git diff --stat` ≤ 400 changed lines before opening any PR |
| Branch gate | Target is the immediate prior slice branch (or `codex/develop` for PR 1a); NEVER `main` |
| Review gate | Fresh review required after each slice merges before next slice starts |
| Type-check gate | `tsc --noEmit` — zero new errors per slice |
| Test gate | `vitest run` — all green per slice |
| Lint gate | `eslint` — zero new violations per slice |
| Smoke-test gate | All 10+ booking paths manually verified after PR 3, PR 4b, and PR 5 |
| Behavior gate | No new `useEffect` / `useCallback` / `useMemo` beyond what existed inline |
| Hook-deps gate | `react-hooks/exhaustive-deps` stays clean on all extracted hooks |
| Export gate | `formatCheckInSummaryDateTime` and `computeCheckInAutofill` remain exported from `EnrollModal.tsx` throughout all slices |
| Type-coupling gate | `ConsecutiveOfferData` remains imported from `checkin/ConsecutiveClassOffer.tsx` — NOT moved in this change |

---

## Rollback Summary

| PR | Rollback Command | State After Rollback |
|----|-----------------|---------------------|
| PR 1b | `git revert <pr1b>` | EnrollModal re-inlines types; PR1a remains valid |
| PR 1a | `git revert <pr1a>` | EnrollModal re-inlines stepValid |
| PR 2 | `git revert <pr2>` | PR1a + PR1b valid; EnrollModal re-inlines init/consecutive effects |
| PR 3 | `git revert <pr3>` | PR1a + PR1b + PR2 valid; EnrollModal re-inlines kiosk hooks |
| PR 4a | `git revert <pr4a>` | PR1a + PR1b + PR2 + PR3 valid; EnrollModal re-inlines sidebar/overlays |
| PR 4b | `git revert <pr4b>` | PR1a + PR1b + PR2 + PR3 + PR4a valid; EnrollModal re-inlines step router |
| PR 5 | `git revert <pr5>` | PR4b valid — ≤ 800-line orchestrator, fully working |

No database or API rollback needed — all changes are file-level only.

---

## Follow-up Tasks (out of scope for this change)

- [ ] FU-1: Promote `ConsecutiveOfferData` type to a shared path (e.g., `lib/checkin/consecutive-offer.types.ts`) and update all consumers. Schedule as a separate tracked task after all 7 PRs land on `codex/develop`.
- [ ] FU-2: Add a Vitest file-size assertion (or CI step) that gates `EnrollModal.tsx` line count ≤ 400 on every future PR touching that file.
