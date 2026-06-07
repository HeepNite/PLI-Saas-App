# Tasks: kiosk-visual-changes

## Implementation Checklist

- [ ] **Task 1: Thread terminal identity props through kiosk component chain**
  - **Description**: Add and wire `terminalLocation` (new) and ensure `terminalName` (existing) is actually destructured and forwarded from terminal shell into check-in client and header path.
  - **Inputs (read first)**: `openspec/changes/kiosk-visual-changes/spec.md` (FR-2, NFR-1), `openspec/changes/kiosk-visual-changes/design.md` (Data Flow, Interfaces / Contracts).
  - **Outputs (change)**: Prop contracts updated and data reaches `CheckInHeader` in terminal mode.
  - **Files to modify**:
    - `components/front/checkin/checkin.types.ts`
    - `components/front/staff/StaffTerminalShell.tsx`
    - `components/front/checkin/CheckInQrClient.tsx`
    - `components/front/checkin/CheckInHeader.tsx`
  - **Depends on**: None
  - **Acceptance criteria**:
    - `CheckInQrClientProps` contains `terminalLocation?: string`.
    - `terminalName` and `terminalLocation` are passed `StaffTerminalShell → CheckInQrClient → CheckInHeader`.
    - No behavior change yet outside prop plumbing.

- [ ] **Task 2: Replace kiosk overlay terminal bar with read-only terminal info in header**
  - **Description**: Remove kiosk top overlay terminal bar UX and render terminal identity as read-only text inside `CheckInHeader` terminal variant.
  - **Inputs (read first)**: `openspec/changes/kiosk-visual-changes/spec.md` (FR-2 scenarios), `openspec/changes/kiosk-visual-changes/design.md` (Architecture Decisions, File Changes).
  - **Outputs (change)**: Header shows terminal identity in terminal mode; no switch action exposed in kiosk page.
  - **Files to modify**:
    - `components/front/staff/StaffTerminalShell.tsx`
    - `components/front/checkin/CheckInHeader.tsx`
  - **Depends on**: Task 1
  - **Acceptance criteria**:
    - `Switch terminal` button is absent in kiosk terminal view.
    - Header displays `{terminalName} · {terminalLocation}` near terminal label area.
    - Empty/null name/location renders safely (no dangling separator-only output).
    - No backend/API contract change (`DELETE /api/staff/terminal/session` remains untouched).

- [ ] **Task 3: Remove kiosk outer wrapper chrome (border/shadow/min-h container styling)**
  - **Description**: In terminal mode only, remove outer process wrapper box visuals (`border`, `rounded`, `shadow`, blur chrome) and terminal-only fixed height constraints that force overflow.
  - **Inputs (read first)**: `openspec/changes/kiosk-visual-changes/spec.md` (FR-3, FR-1), `openspec/changes/kiosk-visual-changes/design.md` (CSS Strategy).
  - **Outputs (change)**: Terminal process content renders directly without kiosk wrapper chrome; non-terminal remains unchanged.
  - **Files to modify**:
    - `components/front/checkin/CheckInQrClient.tsx`
  - **Depends on**: Task 1
  - **Acceptance criteria**:
    - In terminal mode, outer wrapper chrome is removed.
    - `min-h-[60rem]` is not applied in terminal mode.
    - In non-terminal/public flow, previous wrapper styling remains intact.

- [ ] **Task 4: Compact terminal spacing tokens for viewport fit**
  - **Description**: Reduce top/bottom terminal spacing (`pt-28/pt-32` family) to compact values for landscape kiosk fit while preserving shared flow behavior.
  - **Inputs (read first)**: `openspec/changes/kiosk-visual-changes/spec.md` (FR-1, NFR-1), `openspec/changes/kiosk-visual-changes/design.md` (CSS Strategy step 1).
  - **Outputs (change)**: Terminal layout starts higher and consumes less vertical space.
  - **Files to modify**:
    - `components/front/checkin/useCheckInDisplayData.ts`
  - **Depends on**: Task 3
  - **Acceptance criteria**:
    - Terminal `mainSpacingClass` uses compact spacing (e.g., `pt-4/pt-6` family).
    - Public `/checkin` spacing behavior is unchanged.

- [ ] **Task 5: Compact QR split panel sizing for landscape tablet**
  - **Description**: Add terminal-only compact sizing path for QR/home-card split panel (image dimensions, internal paddings, related min-heights) to reduce vertical pressure.
  - **Inputs (read first)**: `openspec/changes/kiosk-visual-changes/spec.md` (FR-1, Edge Cases), `openspec/changes/kiosk-visual-changes/design.md` (File Changes, CSS Strategy steps 3–4).
  - **Outputs (change)**: `CourseCardPanel` supports compact mode and terminal flow opts into it.
  - **Files to modify**:
    - `components/front/checkin/CourseCardPanel.tsx`
    - `components/front/checkin/CheckInQrClient.tsx`
    - `components/front/checkin/CourseCardContent.tsx` *(only if min-height adjustment is implemented there)*
  - **Depends on**: Task 4
  - **Acceptance criteria**:
    - Terminal flow passes compact flag/classes to split panel.
    - QR/panel block occupies less vertical space in terminal landscape.
    - Long terminal text still truncates safely; touch targets remain usable (>=44px where interactive).

- [ ] **Task 6: Update kiosk E2E assertions for relocated terminal identity UI**
  - **Description**: Update terminal latency e2e checks to assert new header-level terminal identity behavior and absence of old overlay text/button expectations.
  - **Inputs (read first)**: `openspec/changes/kiosk-visual-changes/spec.md` (FR-2, Regression Guards, E2E impact), `openspec/changes/kiosk-visual-changes/design.md` (Testing Strategy).
  - **Outputs (change)**: Tests validate new kiosk UI contract.
  - **Files to modify**:
    - `e2e/staff-terminal-latency.spec.ts`
  - **Depends on**: Task 2
  - **Acceptance criteria**:
    - E2E no longer depends on `Active terminal` overlay text.
    - E2E asserts terminal identity visibility in header region (or equivalent new stable selector/text).

- [ ] **Task 7: Regression + viewport validation pass (terminal vs public flow)**
  - **Description**: Verify functional regressions are not introduced and confirm kiosk landscape fit target is met.
  - **Inputs (read first)**: Full spec/design artifacts plus updated test files.
  - **Outputs (change)**: Validation notes/checklist complete; failures become follow-up fixes before verify phase.
  - **Files to modify**:
    - `e2e/staff-terminal-latency.spec.ts` *(only if final assertion tuning is needed)*
    - `openspec/changes/kiosk-visual-changes/tasks.md` *(check off done items during apply phase; no checklist status flips now)*
  - **Depends on**: Tasks 3, 4, 5, 6
  - **Acceptance criteria**:
    - Kiosk content fits ~1200×800 landscape without vertical scroll.
    - `/checkin` behavior/visual contract remains unchanged.
    - QR/check-in flow logic is unaffected.

## Notes

- All implementation changes MUST be gated to terminal mode (`shellVariant === "terminal"`) unless explicitly test-only.
- No new endpoints, schema changes, or new component families are required.
