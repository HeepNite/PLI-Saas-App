# PR Size Gate - Design

## Intent

Add a small, standalone GitHub Actions gate that evaluates pull-request size directly from event metadata and produces a review-oriented failure.

## Reuse Strategy

- Reuse GitHub Actions and the `pull_request` event context.
- Keep the existing `.github/workflows/ci.yml` workflow and `Typecheck (blocking)` check unchanged.
- Reuse the repository's existing ruleset `18629768` during the later operational update.

## Affected Areas

- `.github/workflows/pr-validation.yml` — future standalone size-gate workflow.
- Ruleset `18629768` — future required-check and branch-target update.

## Architecture Constraints

- Trigger only for pull requests whose base is `main` or `codex/develop`.
- Derive the metric only from `github.event.pull_request.additions` and `github.event.pull_request.deletions`.
- Make the threshold and failure guidance visible in check output.
- Do not add a bypass path, dependency, source-code change, or CI refactor.

## Data And Contract Notes

The event payload fields are the sole data contract. The gate passes when their sum is at most 400 and fails otherwise.

## Security And Operational Notes

- Use read-only permissions sufficient for pull-request metadata.
- Do not use secrets or repository-write permissions.
- Publish and ruleset mutation require a later credentialed operation; until then, the documented workflow and ruleset changes are not active in GitHub.
