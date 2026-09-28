# PR Size Gate - Tasks

## Phase 1 - Analysis

- [x] Inspect existing CI and record the current blocking check.
- [x] Identify the existing ruleset and the credential limitation.

## Phase 2 - Resolution

- [x] Define the exact size metric, inclusive threshold, branch scope, and no-bypass policy.
- [x] Separate workflow implementation from blocked publication and ruleset administration.

## Phase 3 - Plan

- [x] Define a standalone workflow that reads pull-request event metadata.
- [x] Define focused boundary validation for totals of 400 and 401.

## Phase 4 - Implementation

- [x] Add `.github/workflows/pr-validation.yml` with a `pull_request` branch filter for `main` and `codex/develop`.
- [x] Implement a check named for the PR size gate that passes at 400 or fewer lines and otherwise fails with split/chained-PR guidance.
- [x] Keep `.github/workflows/ci.yml` unchanged.

## Phase 5 - Validation

- [x] Validate the 400-line passing boundary and the 401-line failing boundary.
- [x] Confirm the workflow does not create an automatic `size:exception` or other bypass.
- [ ] Publish the workflow and require the check for `main` and `codex/develop`.
  - [x] `codex/develop`: workflow merged through PR #538; ruleset `18629768` requires `PR size (blocking)` and preserves `Typecheck (blocking)`.
  - [ ] `main`: merge the isolated rollout and add a main-only required-check ruleset.
