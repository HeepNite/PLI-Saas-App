# Tasks - Staff Panel Charge Collected On A Tablet M2 Reader

Status: `PHASE 1 IMPLEMENTED — PENDING DELIVERY`.

Base: `main`. Each phase ships as its own PR (ported to `codex/develop`).

- [x] Phase 1 — charge pipeline for all four kinds (`package`, `guest_class` (D2), `outstanding`,
      `free_amount`): schema, panel and tablet APIs, roles (owner, admin, staff/front_desk),
      expiry, cancel, webhook fan-out, carrier exclusion, tablet takeover, panel builder, tests.
- [ ] Phase 2 — undated drop-in credits (D1) with a shared package-priority comparator.
- [ ] Phase 3 — `staff/manager` gets the payments board (read + charge).
- [x] Rollout gate (owner decision: "se me hace que vamos por la A, simpre que no toques los kioskos y su flujo"): owner-only `canCreateTerminalCharge` + `TERMINAL_CHARGE_TERMINALS` allowlist of tablet slugs; admin and staff/front_desk return after the live $1 test.
