# Refactor: ProfilePageClient.tsx

## Goal

Behavior-preserving refactor of `components/front/profile/ProfilePageClient.tsx` (3957 LOC) into cohesive modules where no single file exceeds 800 lines.

## Constraints

- **No behavior changes** — product functionality must remain identical.
- **No files touched outside profile scope**: `components/front/staff/**`, `app/api/staff/**`, `docs/specs/batch-staff-admin-refactor/**` are off-limits.
- **No massive formatting** — only change formatting in files being extracted.
- **No mega-utils** — extract by cohesion, not catch-all dumping.
- **Dead code removal only with evidence** — grep + lint + tests before deletion.
- **Tests must stay green** — Vitest unit + Playwright E2E.
- **Small, reviewable commits** — one slice per commit (or small batch).

## Current State

| Metric | Value |
|---|---|
| File size | 3957 lines |
| `useState` hooks | ~70 |
| `useEffect` hooks | 18 |
| `useMemo`/`useCallback` | ~50 |
| Async handlers | ~26 |
| JSX return block | ~1953 lines (single tree) |
| Inline sub-components | 0 |
| Existing extracted module | `profile-utils.ts` (135 LOC) |

## Safety Net

| Layer | Coverage |
|---|---|
| `profile-utils.ts` pure helpers | Vitest: `tests/profile-utils.test.ts` — solid |
| Profile API routes | Vitest: 12 API test files — solid |
| Component behavior | Playwright E2E: `e2e/profile.spec.ts` (371 LOC) — happy paths |
| Internal helpers (formatters, timezone, date math) | **None** — gap to fill in Slice 1 |
| State machine (reschedule 3-step) | **None** — E2E only |

## Acceptance Criteria

1. No file exceeds 800 lines after refactor.
2. `ProfilePageClient.tsx` becomes a thin orchestrator (~250 LOC).
3. All Vitest tests pass: `npx vitest run`.
4. All Playwright E2E tests pass: `node scripts/run-playwright.mjs e2e/profile.spec.ts`.
5. TypeScript compiles cleanly: `npx tsc --noEmit` (no new errors).
6. ESLint passes on changed files: `npx eslint components/front/profile/`.
7. No staff files modified.
