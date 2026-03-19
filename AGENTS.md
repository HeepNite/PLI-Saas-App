# AGENTS.md

## Purpose

This repository uses a strict spec-driven workflow for feature work.

The goal is to replace ad-hoc implementation with a predictable process:

- define behavior first
- resolve ambiguity before coding
- keep context small
- keep one clear source of truth per activity

If a task does not yet have a usable spec, the correct first step is to create or refine it before writing code.

---

## Instruction Hierarchy

When working on a feature, follow this order of truth:

1. `docs/specs/<spec>/requirements.md`
   - Source of truth for product behavior and acceptance criteria.
2. `docs/specs/<spec>/resolve.md`
   - Source of truth for reconciled contract decisions after analysis.
3. `docs/specs/<spec>/design.md`
   - Source of truth for architecture constraints and implementation boundaries.
4. `docs/specs/<spec>/tasks.md`
   - Source of truth for execution order and completion checklist.
5. Existing codebase contracts
   - Reuse current endpoints, auth, validations, and domain terms unless the spec explicitly changes them.
6. Reference documentation in `docs/system/`
   - Background context only, never the behavioral source of truth.

If these layers conflict:

- do not invent a third interpretation
- update or clarify the spec
- keep the code aligned with the resolved contract

---

## One Source Of Truth Rule

Each activity must have one active spec folder.

That spec folder is the only place where feature decisions should accumulate.

Do not spread feature decisions across:

- chat messages
- temporary notes
- unrelated docs
- code comments

Behavior belongs in `requirements.md`.
Resolved decisions belong in `resolve.md`.
Implementation sequencing belongs in `tasks.md`.

---

## Default Workflow

For feature work, use these phases in order:

1. `spec`
   - create or refine the spec
2. `analysis`
   - inspect the codebase and identify conflicts
3. `resolve`
   - reconcile spec vs codebase
4. `plan`
   - propose minimal implementation order
5. `implement`
   - change code only after the plan is accepted
6. `validate`
   - confirm the result against the spec

Do not skip directly from idea to implementation.

---

## Approval Gates

Before implementation starts:

- the spec must be complete enough to avoid guessing
- open conflicts must be resolved
- the implementation plan must be explicit

If a feature is still ambiguous, stay in spec/analysis/resolve mode.

---

## Context Budget Rules

Keep the active context intentionally small.

When working on a spec:

- read `AGENTS.md` first
- read only the active spec files needed for the current phase
- read only code directly related to that spec
- use `docs/system/*` only as targeted reference when necessary

Avoid loading broad documentation unless it directly unblocks the current phase.

The objective is to reduce context noise, not maximize document consumption.

---

## Sub-Agent Strategy

Sub-agents are allowed only when they reduce context load and have a narrow assignment.

Good uses:

- analyze one subsystem
- reconcile one contract conflict
- draft test coverage for one feature
- validate one specific acceptance-criteria group

Rules:

- one parent workflow owns the final synthesis
- sub-agents do not invent business logic
- sub-agent output must flow back into the active spec folder
- final implementation decisions must be recorded in the spec, not only in chat

---

## Reuse-First Rule

Before creating anything new, check whether the codebase already provides:

- an existing endpoint
- an existing auth or permission helper
- an existing domain model
- an existing UI component
- an existing utility

Do not duplicate logic that already exists.

---

## Architecture Constraints

Agents must not:

- invent new endpoints if an existing contract can be reused
- introduce database schema changes unless the spec explicitly requires them
- rename established domain concepts without a spec decision
- introduce third-party libraries without a written justification
- refactor unrelated modules during a scoped implementation

All changes should remain minimal and localized.

---

## Security And Data Rules

Preserve existing:

- authentication flows
- authorization boundaries
- validation rules
- rate limiting
- audit behavior

Do not weaken security to satisfy a spec quickly.
If the spec conflicts with security boundaries, resolve the contract before implementation.

---

## Testing Expectations

If a spec changes behavior, the implementation should include tests that cover the affected surface.

Typical expectations:

- unit tests for policy and decision logic
- API or integration tests for contract changes
- UI or E2E tests for gating and flow behavior

Validation is part of completion, not an optional follow-up.

---

## Code Modification Rules

Agents should avoid:

- speculative abstractions
- large unrelated refactors
- premature optimization
- undocumented behavior changes

The goal is correct, minimal, maintainable code aligned with the active spec.

---

## Repository Structure

Feature specs live in:

`docs/specs/<spec-folder>/`

Standard files:

- `requirements.md`
- `design.md`
- `tasks.md`
- `analysis.md`
- `resolve.md`

Reference docs live in:

`docs/system/`

Prompt scaffolding lives in:

`docs/Prompts/`

---

## Final Rule

If behavior is not defined by the active spec, the resolved contract, or existing code contracts:

- do not guess
- document the ambiguity
- pause and clarify before implementation
