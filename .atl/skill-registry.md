# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Apply modern web development best practices for security, compatibility, and code quality | best-practices | /Users/marianobarrionuevo/.config/opencode/skills/best-practices/SKILL.md |
| Cleaning up large codebases with accumulated debt, removing duplication | codebase-cleanup-refactor-clean | /Users/marianobarrionuevo/.config/opencode/skills/codebase-cleanup/SKILL.md |
| Writing ANY code, refactoring, planning architecture, reviewing code | solid | /Users/marianobarrionuevo/.config/opencode/skills/solid/SKILL.md |
| Creating a GitHub issue, reporting a bug, or requesting a feature | issue-creation | /Users/marianobarrionuevo/.config/opencode/skills/issue-creation/SKILL.md |
| Creating a pull request, opening a PR, or preparing changes for review | branch-pr | /Users/marianobarrionuevo/.config/opencode/skills/branch-pr/SKILL.md |
| Go tests, Bubbletea TUI testing | go-testing | /Users/marianobarrionuevo/.config/opencode/skills/go-testing/SKILL.md |

## Compact Rules

### best-practices
- Enforce HTTPS for all external resources (no mixed content)
- Set security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Run npm audit to check for vulnerable dependencies
- Sanitize all user inputs to prevent XSS and injection attacks
- Use modern browser APIs with progressive fallbacks

### codebase-cleanup-refactor-clean
- Identify high-impact refactor candidates and risks before starting
- Break work into small, testable, reversible steps
- Preserve existing behavior — refactoring must not change functionality
- Always run tests after refactoring; validate with targeted regression checks
- Avoid large rewrites without explicit agreement on scope

### solid
- ALWAYS start with tests (Red-Green-Refactor is mandatory)
- Apply SOLID principles rigorously to every class, module, and function
- Keep functions small and focused (Single Responsibility)
- Favor composition over inheritance; depend on abstractions
- Name things by what they DO, not HOW they do it

### issue-creation
- Blank issues are disabled — MUST use a template (bug or feature)
- Every issue gets `status:needs-review` automatically on creation
- A maintainer MUST add `status:approved` before any PR can be opened
- Questions go to Discussions, not issues

### branch-pr
- Every PR MUST link an approved issue — no exceptions
- Every PR MUST have exactly one `type:*` label
- Branch names MUST match: `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`
- Automated checks must pass before merge is possible

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md | /Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App/AGENTS.md | Index — defines spec-driven workflow, approval gates, context budget rules |
