Read AGENTS.md first.

Then read these files:

- REQUIREMENTS_FILE
- DESIGN_FILE
- TASKS_FILE

Treat `REQUIREMENTS_FILE` as the behavior source of truth.
Treat `DESIGN_FILE` as the architecture guardrail.
Treat `TASKS_FILE` as the execution checklist.

Keep context intentionally narrow.
Do not read broad reference docs unless directly needed to resolve a concrete question in this spec.

Analyze the current codebase and identify:

- existing implementation related to this feature
- affected files
- architecture constraints
- any spec/code conflicts

Do not write code yet.

Write your final analysis to:
- ANALYSIS_FILE

The file must be structured with these sections:

# Analysis
## Existing Implementation
## Affected Files
## Architecture Constraints
## Spec/Code Conflicts
## Recommended Next Focus
