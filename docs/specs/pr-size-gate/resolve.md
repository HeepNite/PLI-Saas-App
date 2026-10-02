# Resolution

## Contract Decisions

- The size metric is exactly `pull_request.additions + pull_request.deletions`.
- The maximum permitted total is 400; the boundary is inclusive.
- The gate applies only when the pull-request base is `main` or `codex/develop`.
- Totals above 400 fail with the total, limit, and guidance to split the work or use chained PRs.
- This change provides no automatic exception mechanism, including `size:exception` labels.

## Context Strategy

Use the GitHub Actions `pull_request` event context as the authoritative source for additions and deletions. This avoids checkout-dependent diff calculation and requires no external service.

## Minimal Architectural Changes

- Add one dedicated pull-request workflow for the size check.
- Preserve `.github/workflows/ci.yml` and its existing `Typecheck (blocking)` check.
- Later, configure the new check as required in the ruleset for `main` and `codex/develop`.

## Spec Adjustments

None. The accepted contract is complete for implementation.

## Implementation Preconditions

- Workflow implementation can proceed without elevated token scope.
- Publishing the workflow and mutating ruleset `18629768` are blocked until credentials include workflow and ruleset permissions.
- The ruleset follow-up must extend coverage to both `main` and `codex/develop` and preserve `Typecheck (blocking)` as required.
