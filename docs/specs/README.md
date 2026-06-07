# Specs Workflow

This folder is the operational center for feature planning and delivery.

The workflow is designed to keep context small, planning explicit, and implementation aligned with one active source of truth.

## Folder Contract

Each feature should live in its own folder:

`docs/specs/<id>-<slug>/`

Standard files:

- `requirements.md`
- `design.md`
- `tasks.md`
- `analysis.md`
- `resolve.md`

### File Roles

- `requirements.md`
  - Canonical behavior, scope, acceptance criteria, and business rules.
- `design.md`
  - Architecture constraints, reuse strategy, module boundaries, and non-functional expectations.
- `tasks.md`
  - Implementation sequence and completion checklist.
- `analysis.md`
  - Derived output from codebase review. Not a behavioral source of truth.
- `resolve.md`
  - Derived contract decisions that reconcile spec and codebase.

## Truth Hierarchy

Use this order:

1. `requirements.md`
2. `resolve.md`
3. `design.md`
4. `tasks.md`
5. existing code contracts
6. reference docs in `docs/system/`

## Working Rules

- Keep one active spec per activity or thread.
- Do not implement before analysis and resolution are complete enough.
- Record decisions inside the active spec folder, not only in chat.
- Use reference docs only when the active spec needs them.
- Keep broad repository docs out of the working context unless strictly needed.

## Recommended Phase Order

1. draft or refine the spec
2. analyze the codebase
3. resolve conflicts
4. produce the implementation plan
5. implement
6. validate

## Sub-Agent Use

Use sub-agents only for narrow, well-bounded work such as:

- subsystem analysis
- conflict resolution draft
- focused validation
- test-plan drafting

The parent workflow remains responsible for final synthesis and for updating the active spec.

## Templates

Use the scaffold in:

`docs/specs/_template/`

The helper script can generate prompts for each phase from the active spec:

`node scripts/codex-spec.mjs list`

`node scripts/codex-spec.mjs analysis <spec-folder>`

`node scripts/codex-spec.mjs resolve <spec-folder>`

`node scripts/codex-spec.mjs plan <spec-folder>`

`node scripts/codex-spec.mjs implement <spec-folder>`

`node scripts/codex-spec.mjs validate <spec-folder>`
