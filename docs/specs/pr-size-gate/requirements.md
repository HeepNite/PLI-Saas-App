# PR Size Gate

## Status

`ACCEPTED`

## Objective

Prevent oversized pull requests from merging without an explicit manual exception process.

## Scope

### In scope

- A GitHub Actions pull-request check for bases `main` and `codex/develop`.
- Size calculation from `pull_request.additions + pull_request.deletions`.
- Passing at 400 changed lines or fewer and failing above 400.
- An actionable failure message recommending smaller or chained pull requests.
- Documenting the intended required-check ruleset integration.

### Out of scope

- Automatic `size:exception` or other label-based bypasses.
- Publishing the workflow or modifying repository rulesets in this change.
- Changing existing CI jobs or their blocking status.

## Context

The repository needs a merge gate that keeps pull requests reviewable. The check applies only to pull requests targeting `main` or `codex/develop`; it does not apply to pushes or other base branches.

## Functional Requirements

- The check runs on the `pull_request` event when the base branch is `main` or `codex/develop`.
- The check computes changed lines as `pull_request.additions + pull_request.deletions` from the event payload.
- A total of 400 or fewer succeeds.
- A total greater than 400 fails.
- Failure output states the observed total, the 400-line limit, and recommends splitting the work or using chained PRs.
- No label, workflow input, or automatic exemption bypasses the limit.

## Constraints

- Keep the implementation limited to the new gate workflow and its repository-rule integration.
- Reuse GitHub-provided pull-request metadata; do not add dependencies or external services.
- The current token cannot publish workflow files or mutate rulesets.
- Existing CI remains at `.github/workflows/ci.yml` unchanged.

## Security Rules

- Use the least privileges required to read pull-request metadata.
- Do not add secrets, tokens, or write permissions.

## Acceptance Criteria

- [ ] A pull request to `main` runs the size gate.
- [ ] A pull request to `codex/develop` runs the size gate.
- [ ] A pull request with `additions + deletions <= 400` passes the gate.
- [ ] A pull request with `additions + deletions > 400` fails with a message that recommends splitting or chained PRs.
- [ ] The gate has no automatic `size:exception` bypass.
- [ ] The check is configured as required for both target branches when workflow publication and ruleset access are available.

## Definition Of Done

- [ ] Implementation matches the accepted behavior.
- [ ] Focused workflow validation covers pass and fail thresholds.
- [ ] Required-check ruleset configuration is completed or explicitly recorded as blocked by token scope.

## Open Questions

None.
