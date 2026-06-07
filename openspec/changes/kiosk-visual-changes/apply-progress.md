# Apply Progress: kiosk-visual-changes

- [x] Task 1: Thread terminal identity props through kiosk component chain — DONE
  - `checkin.types.ts`: Added `terminalLocation?: string` to `CheckInQrClientProps`
  - `StaffTerminalShell.tsx`: Passes `terminalLocation` prop to `CheckInQrClient`
  - `CheckInQrClient.tsx`: Destructures `terminalName` + `terminalLocation`, passes to `CheckInHeader`
- [x] Task 2: Display terminal info as read-only in CheckInHeader — DONE
  - `CheckInHeader.tsx`: Accepts `terminalName` + `terminalLocation` props, renders `{name} · {location}` below breadcrumb in terminal variant
  - Safe fallback: empty/null values filtered with `.filter(Boolean).join()`
- [x] Task 3: Remove Switch Terminal button from kiosk view — DONE
  - `StaffTerminalShell.tsx`: Removed entire absolute overlay bar (Active terminal label, name/location display, Switch terminal button)
  - Removed `signOutTerminal` handler, `busy` state, and unused imports (`Loader2`, `LogOut`, `MonitorSmartphone`)
  - Component now renders only `<CheckInQrClient>` with terminal props
- [x] Task 4: Remove outer wrapper box — DONE
  - `CheckInQrClient.tsx`: `<section>` conditionally renders without `min-h-[60rem]`, `border`, `rounded-2xl`, `shadow`, `backdrop-blur`, padding when `isTerminal`
- [x] Task 5: Viewport fit: adjust spacing and padding — DONE
  - `useCheckInDisplayData.ts`: Terminal `mainSpacingClass` changed from `pt-28 pb-6 sm:pt-32 sm:pb-10` to `pt-4 pb-4 sm:pt-6 sm:pb-6`
- [x] Task 6: Viewport fit: optimize QR split layout — DONE
  - `CourseCardPanel.tsx`: Added `compact?: boolean` prop; reduces QR image to `h-36 w-36`, reduces padding (`px-3 py-3`), smaller grid column width, reduces min-h on card image to `min-h-[160px]`, smaller QR prompt text
  - `CheckInQrClient.tsx`: Passes `compact={isTerminal}` to both `CourseCardPanel` render paths
- [x] Task 7: Update E2E tests — DONE
   - `e2e/staff-terminal-latency.spec.ts`: Changed assertion from `/Active terminal/i` to `/Student check-in/i` (matches new header that no longer has overlay bar)

## Verification Fixes (post-verify warnings)

- [x] Fix 1: Add truncation for long terminal names in CheckInHeader — DONE
  - `CheckInHeader.tsx`: Added `max-w-[200px] truncate` to terminal info `<p>` element to handle edge cases with very long terminal name/location strings
- [x] Fix 2: Strengthen E2E assertion for terminal info — DONE
  - `e2e/staff-terminal-latency.spec.ts`: Added `await expect(page.getByText(/E2E Terminal/)).toBeVisible({ timeout: 5_000 })` after the existing "Student check-in" assertion to validate terminal identity is visible in the header

## Files Modified

| File | Action |
|------|--------|
| `components/front/checkin/checkin.types.ts` | Modified — added `terminalLocation` prop |
| `components/front/staff/StaffTerminalShell.tsx` | Modified — removed overlay bar, cleaned imports |
| `components/front/checkin/CheckInQrClient.tsx` | Modified — destructures terminal props, conditional section classes, passes compact |
| `components/front/checkin/CheckInHeader.tsx` | Modified — accepts + renders terminal identity info |
| `components/front/checkin/useCheckInDisplayData.ts` | Modified — compact spacing for terminal |
| `components/front/checkin/CourseCardPanel.tsx` | Modified — added compact prop for QR/panel sizing |
| `e2e/staff-terminal-latency.spec.ts` | Modified — updated assertion for new UI |
