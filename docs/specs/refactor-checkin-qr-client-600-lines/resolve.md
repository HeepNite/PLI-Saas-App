# Resolve — refactor-checkin-qr-client-600-lines

## Decisions

### 1. Use chained PRs, not one large refactor PR

- **Decision**: Split the refactor into chained/sliced PRs.
- **Why**: Estimated total change is 2,000–2,500 lines; one PR would hide regressions and overload review.

### 2. Extract behavior before JSX

- **Decision**: Extract API adapters and flow hooks before splitting presenter components.
- **Why**: JSX length is not the root problem. The root problem is mixed imperative orchestration. Splitting JSX first would move complexity without reducing coupling.

### 3. Keep `useCheckInDisplayData.ts` out of scope

- **Decision**: Do not split `useCheckInDisplayData.ts` in this change.
- **Why**: It is large, but already extracted. Targeting it would expand scope without being required to bring `CheckInQrClient.tsx` below 600 LOC.

### 4. Keep pure policies in `lib/checkin/*`

- **Decision**: Business decisions stay in `lib/checkin/*` where possible.
- **Why**: Existing tests already protect helpers like `shouldAutoPromoteExistingMode`, `shouldAutoOpenExistingPurchase`, and consecutive flow decisions.

### 5. New hooks live under `components/front/checkin/hooks/`

- **Decision**: Place new orchestration hooks in `components/front/checkin/hooks/`.
- **Why**: `components/front/checkin/` already mixes components and hooks. A `hooks/` subfolder improves discoverability without moving existing hooks immediately.

### 6. API adapter lives in `lib/checkin/checkin-qr-api.ts`

- **Decision**: Shared check-in QR API fetch/body/error parsing should live in `lib/checkin/checkin-qr-api.ts`.
- **Why**: It is not React-specific and will be consumed by multiple hooks.

### 7. Package success timer stays with package check-in ownership

- **Decision**: The 2.5s package success timer and cleanup move with the package/bootstrap hook, not the consecutive hook.
- **Why**: Splitting timer ownership risks issue #35 regressions where the kiosk remains stuck after successful package check-in.

### 8. Presenter extraction is last

- **Decision**: Extract `CheckInShell`, `CheckInOverlays`, and `CheckInEnrollModals` only after behavior hooks stabilize.
- **Why**: Presenters should be mostly prop-driven; doing them last avoids carrying business logic into UI components.

## Open Questions

1. Should the consecutive offer flow slice be split into two or three smaller PRs?
   - **Recommendation**: split if forecast exceeds 400 changed lines.
2. Should `useKioskFlowCompletion.ts` be migrated into the new `hooks/` folder?
   - **Recommendation**: not during this change unless needed; avoid noisy moves.
3. Should the final presenter split include component smoke tests?
   - **Recommendation**: yes, but keep business assertions in hook/policy tests.

## Non-Negotiable Guardrails

- Do not weaken issue #32 behavior.
- Do not alter endpoint contracts.
- Do not combine bootstrap/package and consecutive flow extractions into one giant PR.
- Do not split JSX before tests protect moved orchestration.
