## Exploration: kiosk-visual-changes

### Current State
The kiosk terminal experience is rendered through `app/staff/terminal/page.tsx` → `StaffTerminalShell` → `CheckInQrClient` with `shellVariant="terminal"` and `forcedDeviceMode="station"`. The top “Active terminal” bar (name/location + “Switch terminal” action) is implemented as an absolute overlay in `StaffTerminalShell`, while the main process UI is a bordered `section` inside `CheckInQrClient`.

In terminal mode, the process surface uses large vertical spacing and fixed-height tendencies (`min-h-screen` on `main`, `min-h-[60rem]` on the section, plus top padding from `mainSpacingClass = "pt-28 pb-6 sm:pt-32 sm:pb-10"`). The card area with QR + home card preview comes from `CourseCardPanel` split layout and is always shown in terminal mode (`shouldShowCheckInQrPanel` always returns `true` for `shellVariant === "terminal"`). This explains overflow pressure on tablet landscape heights.

### Affected Areas
- `app/staff/terminal/page.tsx` — kiosk/staff terminal entrypoint; mounts terminal shell when session is valid.
- `components/front/staff/StaffTerminalShell.tsx` — creates the top Active Terminal bar, renders `Switch terminal` button, owns sign-out handler.
- `app/api/staff/terminal/session/route.ts` — DELETE endpoint used by “Switch terminal” to clear terminal session cookie and DB session.
- `components/front/checkin/CheckInQrClient.tsx` — main kiosk page layout (outer process wrapper box, spacing, viewport shell).
- `components/front/checkin/useCheckInDisplayData.ts` — terminal-mode spacing (`mainSpacingClass`), breadcrumb source (currently includes `Terminal` label), and terminal-vs-qr behavior flags.
- `components/front/checkin/CheckInHeader.tsx` — terminal header structure with right-side breadcrumb area where terminal read-only info can be integrated.
- `components/front/checkin/CourseCardPanel.tsx` — process card with “Home card preview” and QR panel (main overflow contributor in landscape).
- `lib/checkin/existing-customer-flow.ts` — logic forcing QR panel visible in terminal mode.
- `lib/checkin/photo-context-policy.ts` — terminal mode maps to `kiosk_terminal` context.
- `components/front/checkin/checkin.types.ts` — `terminalName?: string` prop exists but is currently unused by `CheckInQrClient`.
- `e2e/staff-terminal-latency.spec.ts` — e2e expectation currently checks `Active terminal` text; likely affected by UI text relocation/removal.

### Layout Structure (as implemented)
1. `StaffTerminalShell`
   - Root `div.relative`
   - Absolute top overlay bar (`absolute inset-x-0 top-0 z-50`) with:
     - label `Active terminal`
     - terminal name/location
     - interactive `Switch terminal` button
2. `CheckInQrClient`
   - `<main className="relative min-h-screen overflow-hidden ...">`
   - centered container `max-w-[68rem]`
   - outer process wrapper section:
     - `flex min-h-[60rem] flex-col rounded-2xl border ... p-4 sm:p-6`
   - header `CheckInHeader`
   - body `mt-6 flex flex-1 flex-col justify-center`
   - process card + QR via `CourseCardPanel`

### Kiosk-specific vs Shared
- **Kiosk-specific (staff terminal route):**
  - `app/staff/terminal/page.tsx`
  - `StaffTerminalShell` (Active Terminal bar + switch logic)
  - `shellVariant="terminal"`, `forcedDeviceMode="station"` configuration path
- **Shared across kiosk and non-kiosk check-in:**
  - `CheckInQrClient`
  - `CheckInHeader`
  - `CourseCardPanel`
  - `useCheckInDisplayData`
  - helpers in `lib/checkin/*`

Implication: visual changes should be guarded to terminal mode to avoid regressions in public `/checkin` flow.

### Responsive / Viewport Behavior
- Explicit JS compact check: `window.matchMedia("(max-width: 1023px)")` in `CheckInQrClient`.
- Tailwind responsive classes dominate layout (`sm`, `md`, `lg`, `xl`), with no orientation-specific media query found.
- Terminal mode keeps QR visible regardless of compact viewport (`shouldShowCheckInQrPanel` returns true).
- Current combination (`pt-28/pt-32` + `min-h-[60rem]` + nested card content + QR block) is the primary source of landscape overflow.

### Switch Terminal Button + Handler
- Button location: `StaffTerminalShell.tsx`.
- Handler: `signOutTerminal()` → `fetch("/api/staff/terminal/session", { method: "DELETE" })` → `window.location.assign("/staff/terminal")`.
- Removing this button from kiosk view should not break core check-in flow, but it removes in-page session-reset affordance for staff.

### Approaches
1. **Terminal-only header consolidation (recommended)**
   - Move terminal name/location into `CheckInHeader` terminal variant as read-only text near current right-side header area; remove top Active Terminal overlay from `StaffTerminalShell`.
   - Remove outer process wrapper border/box in terminal mode (or reduce it to a plain container) and tighten terminal spacing tokens.
   - Keep card internals mostly intact, but reduce vertical paddings/heights in terminal mode to fit 10.4" landscape.
   - Pros: Minimal architectural change; clear terminal-only scope; low regression risk for `/checkin`.
   - Cons: Requires careful class branching in shared components.
   - Effort: Medium.

2. **Dedicated kiosk-only layout components**
   - Create separate terminal-specific header/layout/card wrappers and avoid shared class branching.
   - Pros: Cleaner separation long-term; less conditional complexity in shared files.
   - Cons: Higher implementation surface and duplication risk; more tests/update burden.
   - Effort: Medium-High.

### Recommendation
Proceed with **Approach 1**: terminal-mode-only UI adjustments in existing shared components plus removal of `StaffTerminalShell` top bar/button. Reuse existing `shellVariant` and `terminalName` prop path (already typed) to inject read-only terminal info into header, and remove/reduce terminal-only wrapper chrome + spacing to achieve landscape fit with minimal behavioral impact.

### Risks
- `e2e/staff-terminal-latency.spec.ts` currently asserts `Active terminal` visibility and will need expectation updates.
- Shared component edits (`CheckInHeader`, `CheckInQrClient`, `CourseCardPanel`) can regress `/checkin` if terminal gating is incomplete.
- Reducing container heights/padding may impact readability in smaller portrait kiosk scenarios unless breakpoints are tuned.
- Removing “Switch terminal” in kiosk view could affect troubleshooting workflows; admin/staff replacement path must remain discoverable in `/staff/terminal` sign-in/setup views.

### Ready for Proposal
Yes — enough implementation detail is identified (exact files, dependencies, and risk points) to draft proposal/spec/tasks.
