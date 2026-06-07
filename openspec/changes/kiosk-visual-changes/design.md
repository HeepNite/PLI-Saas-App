# Design: Kiosk Visual Changes

## Technical Approach

Targeted CSS/conditional changes in 6 existing files, all gated on `shellVariant === "terminal"`. No new components, no new endpoints, no schema changes. Terminal info (name + location) flows via existing prop path `StaffTerminalShell → CheckInQrClient → CheckInHeader`.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|----------|-------------|-----------|
| Conditional classes in shared components | Duplicate components for kiosk | Minimal surface area; `shellVariant` gate already exists everywhere; duplication would double maintenance burden |
| Thread `terminalName` + new `terminalLocation` via props | Context provider / zustand store | Only 3-level prop chain (Shell → Client → Header); store is overkill for 2 read-only strings |
| Remove `min-h-[60rem]` + reduce padding via `mainSpacingClass` for terminal | CSS `@media (orientation: landscape)` | Orientation media queries affect all devices; terminal gating is already the established pattern |
| Remove outer `<section>` border/shadow in terminal mode only | Hide via `opacity-0` / `invisible` | Removing styles is cleaner than hiding; avoids phantom layout space |
| Integrate terminal info into `CheckInHeader` breadcrumb area | New dedicated terminal info bar component | Header already has a right-aligned nav area in terminal variant; reusing it avoids layout shifts |

## Data Flow

```
StaffTerminalShell (owns terminal.name + terminal.location)
  │
  ├── [REMOVE] absolute overlay bar + "Switch terminal" button
  │
  └── CheckInQrClient (receives terminalName + terminalLocation props)
        │
        ├── useCheckInDisplayData (returns tighter mainSpacingClass for terminal)
        │
        ├── <section> (conditional: no border/min-h/shadow when terminal)
        │
        └── CheckInHeader (receives terminalName + terminalLocation)
              └── renders read-only "Terminal: {name} · {location}" in right column
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `components/front/checkin/checkin.types.ts` | Modify | Add `terminalLocation?: string` to `CheckInQrClientProps` |
| `components/front/staff/StaffTerminalShell.tsx` | Modify | Remove absolute overlay + button + `signOutTerminal` handler; pass `terminalLocation` prop to `CheckInQrClient` |
| `components/front/checkin/CheckInQrClient.tsx` | Modify | Destructure `terminalName` + `terminalLocation`; pass to `CheckInHeader`; conditionally strip `<section>` border/shadow/min-h when `shellVariant === "terminal"` |
| `components/front/checkin/CheckInHeader.tsx` | Modify | Accept `terminalName?` + `terminalLocation?` props; render read-only terminal info in the right nav area replacing breadcrumb for terminal variant |
| `components/front/checkin/useCheckInDisplayData.ts` | Modify | Change `mainSpacingClass` for terminal from `"pt-28 pb-6 sm:pt-32 sm:pb-10"` to `"pt-4 pb-4 sm:pt-6 sm:pb-6"` |
| `components/front/checkin/CourseCardPanel.tsx` | Modify | Reduce QR panel image size and inner padding in terminal mode (accept optional `compact` prop) |
| `e2e/staff-terminal-latency.spec.ts` | Modify | Replace `Active terminal` text assertion with terminal name text or header-level assertion |

## Interfaces / Contracts

```typescript
// checkin.types.ts — additions
export type CheckInQrClientProps = {
  // ... existing props unchanged ...
  terminalName?: string
  terminalLocation?: string  // NEW
}

// CheckInHeader — updated prop signature
type CheckInHeaderProps = {
  variant: "terminal" | "personal"
  eyebrow: string
  welcomeLabel: string
  showWelcome: boolean
  breadcrumbItems: string[]
  terminalName?: string       // NEW
  terminalLocation?: string   // NEW
}

// CourseCardPanel — updated prop signature
type CourseCardPanelProps = {
  // ... existing props unchanged ...
  compact?: boolean  // NEW — reduces image/padding sizes for viewport fit
}
```

## CSS Strategy for Viewport Fit

Target: 10.4" landscape = ~1200×800 CSS px (Samsung Galaxy Tab S6 Lite density).

1. **`mainSpacingClass`**: `pt-28/pt-32` (112/128px top pad from overlay) → `pt-4/pt-6` (16/24px). This alone recovers ~100px.
2. **`<section>` wrapper**: Remove `min-h-[60rem]` (960px — taller than viewport), `border`, `rounded-2xl`, `shadow`, `backdrop-blur`. Replace with plain container `flex flex-col flex-1`.
3. **`CourseCardPanel` split mode**: Reduce QR image from `h-48/h-56 w-48/w-56` to `h-36 w-36`; reduce surrounding padding. Add `compact` prop to gate this.
4. **`CourseCardContent` image**: `min-h-[220px]` in split → `min-h-[160px]` when compact.

Estimated recovery: ~250px vertical, bringing total content height under 800px.

## Gating Strategy

All changes use a single, already-established mechanism:

| Layer | Gate |
|-------|------|
| `StaffTerminalShell` | File is kiosk-only — changes are inherently scoped |
| `CheckInQrClient` render | `shellVariant === "terminal"` ternary on section classes |
| `useCheckInDisplayData` | `shellVariant === "terminal"` ternary on `mainSpacingClass` |
| `CheckInHeader` | `variant === "terminal"` branch (already exists) |
| `CourseCardPanel` | New `compact` boolean prop; only passed `true` from terminal flow |

No changes fire in the public `/checkin` flow because `shellVariant` defaults to `"qr"`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| E2E | Terminal page loads without "Active terminal" overlay, shows terminal name in header | Update `staff-terminal-latency.spec.ts` assertion |
| Visual | No scroll on 1200×800 viewport | Manual QA on tablet; optionally Playwright `page.evaluate(() => document.body.scrollHeight <= window.innerHeight)` |
| Regression | `/checkin` QR flow unchanged | Existing E2E tests pass without modification (no terminal gate triggered) |

## Migration / Rollout

No migration required. Pure frontend CSS/prop changes. Rollback = revert commits.

## Open Questions

- None blocking. All decisions are resolvable from existing code patterns.
