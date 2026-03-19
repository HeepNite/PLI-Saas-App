Read AGENTS.md first.

Then read these files:

- REQUIREMENTS_FILE
- DESIGN_FILE
- TASKS_FILE
- ANALYSIS_FILE
- RESOLVE_FILE

Treat `REQUIREMENTS_FILE` and `RESOLVE_FILE` as the source of truth.
Use `DESIGN_FILE` only for boundary and contract expectations.

Keep context intentionally narrow.
Validate the active spec, not the entire repository.

Validate the implementation against the specification.

Check:

- acceptance criteria
- API contract
- security constraints
- UI and flow behavior
- test coverage expectations

Report any mismatch clearly.
