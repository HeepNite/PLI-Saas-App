## Exploration: course-panel-breadcrumb-flow

### Current State
The staff portal renders all school operations under `nav=schedule` inside one very large client component (`StaffUsersAdminClient`). The “School” view already contains multiple independent blocks: overview stats cards, private reservations, room management, course studio, package builder, and points builder. Navigation currently works at section level (users/students/school/etc.) through `nav`, with an optional `course` query param that hydrates course form state. There is no dedicated internal breadcrumb/state machine for sub-flows inside School/Courses; users must scroll and mentally track where they are.

### Affected Areas
- `components/front/staff/StaffUsersAdminClient.tsx` — main School UI composition, current cards/sections, `nav` and `course` query handling, and where a breadcrumb/sub-flow model would live.
- `app/staff/school/course/[slug]/page.tsx` — redirects to `nav=schedule&course={slug}`; currently only deep-links into edit context, not into a richer flow step.
- `app/staff/portal/page.tsx` — portal entry receiving `nav` query state; relevant if we formalize additional route/query flow semantics.
- `app/api/staff/school/courses/route.ts` — course CRUD contract used by the School view; flow changes should preserve payload and validation behavior.
- `app/api/staff/school/course-links/route.ts` — consecutive-course links count/management surfaced in School stats; part of the course-management mental model.
- `tests/api/staff-school.test.ts` — existing backend contract tests to keep stable while reorganizing front-end flow.

### Approaches
1. **In-page flow orchestration (single route, structured sub-navigation)** — keep `nav=schedule`, add a local sub-flow model (`overview → courses → packages → points → reservations/rooms`) with breadcrumb UI and section anchors/cards grouped as a coherent course-management journey.
   - Pros: Minimal routing risk; reuses current APIs/forms; lowest migration cost; can be phased incrementally.
   - Cons: `StaffUsersAdminClient` is already very large, so adding flow logic here increases complexity unless extracted into subcomponents.
   - Effort: Medium

2. **Nested School routes (route-driven breadcrumb)** — split School into dedicated routes/subpages (e.g., `/staff/portal/school/courses`, `/packages`, etc.) and derive breadcrumb from route segments.
   - Pros: Clear URL semantics; natural deep-linking/back-forward behavior; better long-term modularity.
   - Cons: Higher change surface (routing + permissions + hydration + legacy redirects); larger QA scope; more risk for current `nav`-driven permissions and state.
   - Effort: High

### Recommendation
Start with **Approach 1** as a low-cost SDD step: introduce a clear in-page breadcrumb/sub-flow inside `nav=schedule`, and group existing School blocks into an explicit course-management path without changing backend contracts. In parallel, extract School subsections into smaller presentational components to reduce risk and prepare a later migration to route-driven subpages if needed.

### Risks
- `StaffUsersAdminClient.tsx` size and coupling can make UI changes fragile without extraction.
- Existing query-parameter behavior (`nav`, `course`) may conflict with new flow-state params if naming isn’t standardized.
- Users could lose context if scroll-based placement and breadcrumb state get out of sync.
- Recent stats-card tweaks (including active packages count semantics) can regress if overview cards are moved/recomputed incorrectly.

### Ready for Proposal
Yes — proceed to proposal defining the target School/Courses information architecture, breadcrumb state contract (URL vs local state), and phased extraction plan with no API contract changes.
