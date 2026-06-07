# Specification: Kiosk Visual Changes

## Scope

This specification defines visual and UI-behavior changes for the **kiosk terminal experience** only. All requirements are constrained to flows where `shellVariant === "terminal"` and must not alter public `/checkin` behavior.

---

## 1. Functional Requirements

### FR-1: Viewport Fit (10.4" tablet landscape)

1. In kiosk terminal mode, all primary check-in content MUST fit within the viewport in landscape orientation without requiring vertical page scroll.
2. Terminal-mode top spacing MUST be reduced from the current large offset (`pt-28/pt-32`) to compact values (`pt-4`/`pt-6` or equivalent).
3. Terminal-mode process container MUST NOT enforce `min-h-[60rem]`.
4. Terminal-mode QR split layout MUST be compacted (reduced spacing and visual block sizes) to optimize fit in ~1200×800 CSS pixels.
5. The target viewport for validation is approximately **1200×800 CSS pixels** (10.4" tablet landscape class).

### FR-2: Active Terminal → Read-Only Info

1. The kiosk terminal UI MUST remove the visible **"Switch terminal"** button from the terminal page shell.
2. Terminal identity MUST be shown as read-only text in `CheckInHeader`, near the existing right-side Terminal label area.
3. Read-only terminal display format MUST be:
   - `{terminalName} · {terminalLocation}`
4. `terminalName` MUST be wired from existing props (already typed but previously unused in client rendering path).
5. `terminalLocation` MUST be added and wired through the same render path as terminal name.
6. Backend behavior for terminal session deletion MUST remain unchanged:
   - `DELETE /api/staff/terminal/session` contract remains intact.
   - Only kiosk UI affordance is removed.

### FR-3: Remove Outer Wrapper

1. In kiosk terminal mode, the outer visual wrapper (border/chrome container around the process area) MUST be removed.
2. The page MUST render the process content directly (header + process card/content) without the extra bordered shell.
3. This simplification MUST contribute to viewport-fit goals in FR-1.

---

## 2. Non-Functional Requirements

### NFR-1: Strict Gating
All visual/behavioral changes in this spec MUST be gated by `shellVariant === "terminal"`. Public `/checkin` flow (`shellVariant !== "terminal"`) must have zero behavioral and visual impact.

### NFR-2: Touch Target Safety
Any remaining interactive touch targets in kiosk mode MUST preserve at least **44px** minimum touch dimensions.

### NFR-3: Architectural Constraints
Implementation MUST NOT introduce:
- new components,
- new API endpoints,
- database schema changes.

### NFR-4: Workflow Constraint
No build step is required as part of this change execution/validation workflow.

---

## 3. Acceptance Scenarios (Given/When/Then)

### FR-1 Scenarios

#### Scenario FR1-Happy: Landscape viewport fits without vertical scroll
**Given** kiosk terminal mode is active (`shellVariant === "terminal"`)  
**And** viewport is set to ~1200×800 CSS pixels in landscape  
**When** the check-in page is rendered with terminal QR split content  
**Then** the primary kiosk content is fully visible without vertical page scrolling  
**And** top spacing is visibly compact compared to prior terminal layout.

#### Scenario FR1-Edge: Portrait orientation is not a hard no-scroll target
**Given** kiosk terminal mode is active  
**And** viewport is portrait/narrow (smaller vertical composition constraints differ)  
**When** content exceeds vertical space  
**Then** vertical scrolling is acceptable  
**And** this does not fail acceptance because landscape is the target mode.

### FR-2 Scenarios

#### Scenario FR2-Happy: Read-only terminal info replaces switch action
**Given** a valid active terminal session with terminal name and location  
**When** kiosk terminal page renders  
**Then** no "Switch terminal" button is visible in kiosk UI  
**And** header shows read-only terminal text as `{terminalName} · {terminalLocation}` near Terminal label area.

#### Scenario FR2-Edge: Missing or partial terminal identity data
**Given** kiosk terminal mode is active  
**And** `terminalName` or `terminalLocation` is null/empty/missing  
**When** header renders terminal information  
**Then** UI shows graceful fallback behavior (safe placeholder or hidden segment)  
**And** no broken separator-only output (e.g., just `·`) is displayed.

### FR-3 Scenarios

#### Scenario FR3-Happy: Wrapper chrome removed in kiosk mode
**Given** kiosk terminal mode is active  
**When** the check-in process section renders  
**Then** the outer border/chrome wrapper is absent  
**And** only process content structure (header + card/content) is presented on page.

#### Scenario FR3-Edge: Shared flow preserves existing wrapper styling
**Given** non-terminal/public check-in flow (`shellVariant !== "terminal"`)  
**When** the check-in page renders  
**Then** existing outer process wrapper styling remains unchanged  
**And** no kiosk simplification leaks into shared/public view.

---

## 4. Regression Guards

1. Public `/checkin` flow (`shellVariant !== "terminal"`) MUST render identically before/after this change.
2. "Active terminal" bar + "Switch terminal" behavior in non-kiosk staff/admin contexts MUST remain available where currently expected outside kiosk render path.
3. QR display, scan flow, and check-in logic MUST remain functionally unchanged.

---

## 5. Edge Cases

1. **Empty/null terminal name**
   - UI must use fallback text or hide terminal string safely.
2. **Portrait orientation**
   - Scroll may occur; this is acceptable and non-blocking.
3. **Very long terminal name/location**
   - Text must truncate with ellipsis to avoid layout breakage.

---

## 6. E2E Test Impact

1. `e2e/staff-terminal-latency.spec.ts` currently asserting `"Active terminal"` MUST be updated to assert the new header-level read-only terminal info behavior.
2. Existing public `/checkin` E2E test suite MUST continue passing unchanged.

---

## Out of Scope

- Changing terminal session backend endpoints or semantics.
- Introducing orientation-specific global CSS policies for all flows.
- Refactoring unrelated check-in components beyond terminal-gated visual adjustments.
