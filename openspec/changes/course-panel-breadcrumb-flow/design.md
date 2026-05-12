# Design: Course Panel Breadcrumb Flow

## Technical Approach

Implement the flow as a thin in-panel navigation layer inside the existing `nav=schedule` School view. Keep `StaffUsersAdminClient.tsx` as the orchestration owner for this change, but isolate the new concern with small local constants/helpers and a presentational breadcrumb block near the School builder summary. Existing course, package, points, reservation, room, and course-link forms remain in place; the design only gives them stable section anchors and a deterministic step model.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Flow ownership | Local School view state in `StaffUsersAdminClient.tsx` | New routes; global store; backend state | Current School panel already owns `activeNav`, `courseHydratedFromQuery`, forms, and `fetchSchoolData`; adding a store would amplify a large-component problem instead of localizing it. |
| Step source of truth | Constant step map: `overview`, `courses`, `packages`, `points`, `rooms` | Scroll observer-derived active step | Explicit step state avoids desync and is testable. Scroll can be a future enhancement, not required for this spec. |
| Query compatibility | Preserve `nav=schedule&course=<slug>`; do not require new query params | Add required `step`/nested routes | Existing deep links and redirect page already target `course`. The selected course should hydrate the course form and set active step to `courses`. |
| Component extraction | Only extract tiny presentational helpers if needed | Split full School builder now | The file is large, but a broad refactor is out of scope and riskier. Thin wrappers reduce coupling without touching API/form contracts. |

## Data Flow

```text
/staff/school/course/[slug]
  └─ redirect /staff/portal?nav=schedule&course=slug
        └─ StaffUsersAdminClient useSearchParams
              ├─ activeNav = schedule
              ├─ fetchSchoolData()
              ├─ hydrate course form from course param
              └─ activeSchoolFlowStep = courses

Breadcrumb click ──→ set active step ──→ scroll/focus section ref
Forms/APIs remain unchanged.
```

## File Changes

| File | Action | Description |
|---|---|---|
| `components/front/staff/StaffUsersAdminClient.tsx` | Modify | Add local `SchoolFlowStep` model, refs for existing School articles, breadcrumb/process UI, and click handlers that focus/scroll to current sections. Keep existing form state and API calls unchanged. |
| `app/staff/school/course/[slug]/page.tsx` | Keep/verify | Existing redirect to `?nav=schedule&course=...` already matches the intended entry contract; no change unless tests expose encoding issues. |
| `app/staff/portal/page.tsx` | Keep/verify | Existing page passes query handling to the client; no server contract change required. |
| `app/api/staff/school/courses/route.ts` | No change | UI-only flow; course payload and validations remain unchanged. |
| `app/api/staff/school/course-links/route.ts` | No change | Consecutive class metrics stay best-effort via existing fetch. |

## Interfaces / Contracts

```ts
type SchoolFlowStepKey = "overview" | "courses" | "packages" | "points" | "rooms"

type SchoolFlowStep = {
  key: SchoolFlowStepKey
  label: string
  description: string
}
```

The `course` query param remains optional. Unknown course slugs MUST NOT break rendering; the panel should stay on overview/courses with current behavior.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Step constants/helpers and query-to-step resolution | Add focused tests for `course` present/absent and unknown step safety if helpers are extracted. |
| Component | School breadcrumb renders, step click scroll/focus is called, `course` query selects Courses step | React Testing Library around `StaffUsersAdminClient` with mocked `useSearchParams` and fetch responses. |
| Integration | Redirect contract from `/staff/school/course/[slug]` | Verify redirect URL remains `/staff/portal?nav=schedule&course=<encoded>`. |

## Migration / Rollout

No migration required. Rollout is UI-only and reversible by removing the breadcrumb/process wrapper and refs.

## Open Questions

- [ ] Should active step update automatically while scrolling, or is click-driven orientation enough for this iteration?
