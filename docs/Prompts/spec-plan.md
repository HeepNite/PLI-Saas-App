Read AGENTS.md first.

Then read these files:

- REQUIREMENTS_FILE
- DESIGN_FILE
- TASKS_FILE
- ANALYSIS_FILE
- RESOLVE_FILE

Treat `REQUIREMENTS_FILE` and `RESOLVE_FILE` as the source of truth.
Treat `DESIGN_FILE` as the implementation boundary.

Keep context intentionally narrow.
Do not expand into unrelated docs or code once the affected files are known.

Based on the specification and the current codebase, propose a minimal implementation plan.

Include:

- files to modify
- files to create
- risks
- implementation order
- remaining spec/code concerns

Do not implement yet.
