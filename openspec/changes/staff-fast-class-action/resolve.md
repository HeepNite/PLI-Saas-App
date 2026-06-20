# Resolve: Staff Fast Class Action

## Decisions

| Topic | Decision |
|------|----------|
| Source of current class | Extract the terminal current-class resolver into a server-safe helper and use it from both terminal-facing code and the new staff endpoint. The staff card MUST NOT send a manually selected class. |
| Endpoint shape | Add a staff-only endpoint: `POST /api/staff/students/fast-class-action`. Input is `userId` plus optional `acceptConsecutive` and selected promo identifier from the server-provided offer. |
| Authorization | Use `authorizeStudentOperationalRequest()` so owner/admin/front_desk can operate; reject all others. |
| Action mode | Server decides the mode from authoritative package eligibility for the resolved current class. UI `activePackage` only controls the optimistic label. |
| Fast Pay amount | Use `CourseCatalog.dropInPriceCents` for the current class; if missing, default to `2000` cents for v1. |
| Fast Pay persistence | In one transaction, create/reuse session, create/update attendance as `checked_in_no_package`, and create one pending kiosk-source cash `Purchase` if no matching open cash purchase already exists for the same user/class slot. |
| Fast Sign persistence | In one transaction, create/reuse session, create/update attendance as `checked_in`, reserve one package credit, and ensure the zero-dollar kiosk-source package-credit purchase record. |
| Repeat clicks | Return existing attendance/purchase/package usage when the same user/class slot was already processed; do not duplicate charge or credit usage. |
| Promo offer | Before mutating attendance or purchases, the UI asks the endpoint for a `previewOnly` response. If a linked later class exists today, the UI shows a popup asking `Staying for the next class?`. |
| Promo acceptance | A single mutation request with `includeConsecutive: true` creates/reuses the first class session and linked class session, marks attendance, and creates pending cash purchases for the first class and promo amount. |
| Promo package behavior | Package holders do NOT spend a second package credit for the promo class in v1; promo is always cash outstanding balance. |
| Outstanding balance | Do not add a new model/field. Pending cash `Purchase` rows are the source of truth and existing staff loaders will calculate balance. |
| UI labels | Use `Fast Pay`, `Fast Sign`, `Prov PIN`, and `Staying for the next class?`. |

## Resolved Flow

1. Staff clicks adaptive button on a registered student card.
2. Endpoint resolves current terminal class from today's ET schedule/time.
3. Endpoint recomputes package eligibility.
4. Endpoint performs either Fast Pay or Fast Sign transaction.
5. Endpoint returns action result and optional linked promo offer.
6. If staff accepts promo, UI calls same endpoint with `acceptConsecutive: true`.
7. Staff board refreshes so attendance/package/balance totals update.

## Open Questions

- None for v1. If staff later needs manual class override, it will be a separate change.

## Review Workload Forecast

- Expected size: Medium-to-large because it touches API, shared check-in helpers, staff card UI, and tests.
- Delivery strategy: keep as one feature branch but commit by work unit; if implementation exceeds review budget, split helper/API and UI commits.
