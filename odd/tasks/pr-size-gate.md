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
- [ ] 4. Complete rollout by publishing the workflow and activating the required check on both target branches.

## Evidence

- `codex/develop` rollout completed through PR #538 at merge commit `461425a`; ruleset `18629768` requires `Typecheck (blocking)` and `PR size (blocking)`.
- `main` rollout branch: `ci/pr-size-gate-main`.
- Independent verification: YAML parsed; 400 passed; 401, missing metadata, and invalid metadata failed; no bypass/write permissions; existing CI unchanged; whitespace checks passed.
- Original work-unit commit: `ebfdcd2` (`ci: enforce 400-line pull request limit`).
- Main rollout commits: `1136a2f2` and `42e31092`.
