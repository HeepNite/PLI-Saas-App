Read AGENTS.md first.

Then read these files:

- REQUIREMENTS_FILE
- DESIGN_FILE
- TASKS_FILE
- ANALYSIS_FILE

Treat `REQUIREMENTS_FILE` as the behavior source of truth.
Use `ANALYSIS_FILE` to reconcile the spec with the current codebase.

Keep context intentionally narrow.
Only pull in extra files that are directly needed to resolve a concrete contract conflict.

Your task is to resolve any conflicts discovered during analysis and prepare the feature for clean implementation.

Rules:
- prefer minimal architectural change
- do not invent new endpoints unless absolutely necessary
- preserve existing authentication and authorization rules
- avoid database changes unless unavoidable
- keep the system aligned with clean code and SOLID principles

Output must contain:

# Resolution
## Contract Decisions
## Context Strategy
## Minimal Architectural Changes
## Spec Adjustments
## Implementation Preconditions

Write your final resolution to:
- RESOLVE_FILE
