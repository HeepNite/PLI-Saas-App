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
Only touch files required by the active spec unless a direct dependency forces a small adjacent change.

Implement the feature strictly following the specification.

Constraints:

- keep changes minimal and localized
- reuse existing endpoints and contracts
- do not introduce schema changes unless explicitly required
- avoid speculative abstractions
- follow clean code and SOLID principles
- add or update relevant tests
