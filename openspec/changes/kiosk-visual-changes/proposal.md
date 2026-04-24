# Proposal: Kiosk Visual Changes

## Intent

Modify the Kiosk Terminal UI to fit the entire process flow within a 10.4" tablet viewport in landscape mode without scrolling. Enhance terminal security by moving the Active Terminal information to read-only text in the header and removing the "Switch terminal" action to prevent accidental misconfigurations by users. Minimize container chrome to maximize available screen space.

## Scope

### In Scope
- Adjust vertical spacing and padding in terminal mode to fit landscape bounds.
- Move terminal name/location text into the `CheckInHeader` as read-only.
- Remove the "Switch terminal" interactive button and top bar from `StaffTerminalShell`.
- Remove the outer bordered wrapper box from the main process view in terminal mode.
- Update `e2e/staff-terminal-latency.spec.ts` assertions.

### Out of Scope
- Modifications to the core check-in business logic.
- Changes to the public non-kiosk `/checkin` layout.
- Creating new backend endpoints.

## Capabilities

### New Capabilities
- `kiosk-terminal-ui`: Defines the structural layout and specific UI constraints for the station/terminal shell variant.

### Modified Capabilities
- None

## Approach

Implement targeted UI adjustments protected by `shellVariant === "terminal"` within existing shared components (`CheckInQrClient`, `CheckInHeader`, `CourseCardPanel`). 
1. Remove the absolute "Active Terminal" overlay and "Switch terminal" button from `StaffTerminalShell`.
2. Inject the `terminalName` into `CheckInHeader` to display as read-only text.
3. Remove the outer process wrapper `div` borders and padding in `CheckInQrClient` for terminal mode.
4. Reduce `mainSpacingClass` values inside `useCheckInDisplayData` to eliminate landscape overflow.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/staff/StaffTerminalShell.tsx` | Modified | Remove "Active terminal" overlay and button. |
| `components/front/checkin/CheckInQrClient.tsx` | Modified | Remove outer wrapper box and pass terminal prop. |
| `components/front/checkin/CheckInHeader.tsx` | Modified | Render read-only terminal info. |
| `components/front/checkin/useCheckInDisplayData.ts` | Modified | Adjust terminal spacing classes. |
| `components/front/checkin/CourseCardPanel.tsx` | Modified | Reduce internal paddings/heights. |
| `e2e/staff-terminal-latency.spec.ts` | Modified | Update UI assertions for terminal text. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Layout regressions in public `/checkin` | Med | Strictly gate all new styles with `shellVariant === "terminal"`. |
| Loss of quick terminal switching | Low | Staff can manually navigate to `/staff/terminal` or clear sessions via dashboard. |

## Rollback Plan

Revert the frontend UI commits, restoring the `StaffTerminalShell` absolute overlay and `CheckInQrClient` outer wrapper box. No database migrations are involved.

## Dependencies

- None

## Success Criteria

- [ ] Kiosk UI (process card + QR + home card preview) fits entirely without scrolling on a 10.4" tablet in landscape.
- [ ] Active Terminal information is displayed as read-only text in the header.
- [ ] "Switch terminal" button is removed from the kiosk view.
- [ ] Outer wrapper box/border is removed.
- [ ] Existing E2E tests are updated and pass.
