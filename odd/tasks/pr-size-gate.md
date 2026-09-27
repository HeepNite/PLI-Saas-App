# PR Size Gate

## Goal

Enforce a 400 changed-line review budget for pull requests targeting `main` or `codex/develop`.

## Decisions

- Count `additions + deletions` from the pull request payload.
- Pass at 400 changed lines; fail above 400.
- Run only for pull requests targeting `main` or `codex/develop`.
- Make the check required for both protected target branches.
- Do not add an automatic exception path in this change.

## Tasks

- [x] 1. Record the accepted behavior and implementation boundaries in `docs/specs/pr-size-gate/`.
- [x] 2. Implement `.github/workflows/pr-validation.yml` with a deterministic PR-size check.
- [x] 3. Validate workflow syntax and boundary behavior at 400 and 401 changed lines.
- [ ] 4. Publish the workflow and update the repository ruleset after GitHub authentication has `workflow` scope.

## Evidence

- Current ruleset: `codex-develop-gate` (`18629768`) requires `Typecheck (blocking)` only and targets `codex/develop`.
- Current GitHub token scopes: `gist`, `read:org`, `repo`; `workflow` is missing.
- Work branch: `ci/pr-size-gate` in `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/pr-size-gate`.
- Independent verification: YAML parsed; 400 passed; 401, missing metadata, and invalid metadata failed; no bypass/write permissions; existing CI unchanged; whitespace checks passed.
- Work-unit commit: `ebfdcd2` (`ci: enforce 400-line pull request limit`).
