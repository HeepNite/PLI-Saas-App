# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Apply modern web development best practices, security audit, modernize code, code quality review, check for vulnerabilities | best-practices | /Users/marianobarrionuevo/.config/opencode/skills/best-practices/SKILL.md |
| Clean up large codebases, remove duplication, simplify modules, align with clean code standards | codebase-cleanup-refactor-clean | /Users/marianobarrionuevo/.config/opencode/skills/codebase-cleanup/SKILL.md |
| Writing ANY code, implementing features, refactoring, planning architecture, designing systems, reviewing code, debugging | solid | /Users/marianobarrionuevo/.config/opencode/skills/solid/SKILL.md |
| JavaScript animation library, animation in React/Vue/vanilla, GSAP tweens, easing, basic animation, responsive or reduced-motion animation, animating DOM/SVG with GSAP | gsap-core | /Users/marianobarrionuevo/.config/opencode/skills/gsap-core/SKILL.md |
| Animation in React or Next.js, GSAP with React, useGSAP hook, cleanup on unmount | gsap-react | /Users/marianobarrionuevo/.config/opencode/skills/gsap-react/SKILL.md |
| Sequencing animations, choreographing keyframes, animation order, timelines (in GSAP or when recommending a library that supports timelines) | gsap-timeline | /Users/marianobarrionuevo/.config/opencode/skills/gsap-timeline/SKILL.md |
| Scroll-based animation, parallax, pinned sections, ScrollTrigger, scroll animations, pinning | gsap-scrolltrigger | /Users/marianobarrionuevo/.config/opencode/skills/gsap-scrolltrigger/SKILL.md |
| Optimizing GSAP animations, reducing jank, animation performance, FPS, smooth 60fps | gsap-performance | /Users/marianobarrionuevo/.config/opencode/skills/gsap-performance/SKILL.md |
| GSAP plugin, scroll-to, flip animations, draggable, SVG drawing, plugin registration | gsap-plugins | /Users/marianobarrionuevo/.config/opencode/skills/gsap-plugins/SKILL.md |
| gsap.utils, clamp, mapRange, random, snap, toArray, wrap, helper utilities in GSAP | gsap-utils | /Users/marianobarrionuevo/.config/opencode/skills/gsap-utils/SKILL.md |
| Animation in Vue, Nuxt, Svelte, SvelteKit, GSAP with Vue/Svelte, onMounted, onMount, onDestroy | gsap-frameworks | /Users/marianobarrionuevo/.config/opencode/skills/gsap-frameworks/SKILL.md |
| UI/UX design, design system, color palette, typography, landing page, dashboard styling | ui-ux-pro-max | /Users/marianobarrionuevo/.config/opencode/skills/ui-ux-pro-max/SKILL.md |
| Creating a GitHub issue, reporting a bug, requesting a feature | issue-creation | /Users/marianobarrionuevo/.config/opencode/skills/issue-creation/SKILL.md |
| Creating a pull request, opening a PR, preparing changes for review | branch-pr | /Users/marianobarrionuevo/.config/opencode/skills/branch-pr/SKILL.md |
| Judgment day, review adversarial, dual review, doble review, juzgar, que lo juzguen | judgment-day | /Users/marianobarrionuevo/.config/opencode/skills/judgment-day/SKILL.md |
| Create a new skill, add agent instructions, document patterns for AI | skill-creator | /Users/marianobarrionuevo/.config/opencode/skills/skill-creator/SKILL.md |
| Writing Go tests, using teatest, adding test coverage | go-testing | /Users/marianobarrionuevo/.config/opencode/skills/go-testing/SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### best-practices
- Enforce HTTPS everywhere; never mix content
- Set security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin
- Sanitize user input: use textContent or DOMPurify; never innerHTML with raw input
- Use feature detection (`'IntersectionObserver' in window`) not UA sniffing
- Use passive event listeners for touch/wheel: `{ passive: true }`

### codebase-cleanup-refactor-clean
- Split functions > 50 lines into smaller units
- Extract classes > 200 lines into focused smaller classes
- Apply Rule of Three for duplicate code → shared utilities
- Replace primitive obsession with value objects
- Distribute god object responsibilities
- Preserve existing behavior; always run tests after refactoring

### solid
- TDD is mandatory: Red-Green-Refactor; Three Laws of TDD apply
- SOLID principles on every class/module/function
- Naming priority: Consistency > Understandability > Specificity > Brevity > Searchability
- Early returns over else; one level of indentation per method
- Wrap primitives in domain objects (UserId, Email, Money)
- Keep classes < 50 lines, methods < 10 lines, max 2 instance variables per class
- Use `Object.hasOwn(...)` not `in` operator when validating untrusted strings

### gsap-core
- Use gsap.to / from / fromTo with camelCase vars
- Prefer transform aliases (x, y, scale, rotation) over raw transform string
- Default ease: power1.out; built-in eases preferred
- Use stagger for grouped delays instead of manual tween delays
- Set immediateRender: false on later from()/fromTo() tweens when multiple target same property

### gsap-react
- Use useGSAP() hook instead of useEffect for GSAP setup
- Register useGSAP plugin before first use; do not register inside re-rendering components
- Always pass scope ref to limit selectors to component root
- Cleanup runs automatically on unmount; use contextSafe for callbacks to avoid React warnings
- Use revertOnUpdate: true when dependencies drive animation changes

### gsap-timeline
- Use position parameter for precise placement: absolute, +=, -=, <, labels
- Pass defaults into timeline constructor for shared child tween config
- Use labels for readable, maintainable sequencing
- Timelines can be nested; master timeline controls children

### gsap-scrolltrigger
- Register ScrollTrigger once with gsap.registerPlugin(ScrollTrigger)
- start/end format: "triggerPosition viewportPosition"; use clamp() to keep within bounds
- Use scrub for scroll-linked progress; pin only what is needed
- Call ScrollTrigger.refresh() only when layout actually changes; debounce on resize
- Remove markers before production

### gsap-performance
- Animate transform (x, y, scale, rotation) and opacity only; avoid width/height/top/left
- Use will-change in CSS only on elements that actually animate
- Use stagger instead of many separate tweens with manual delays
- Use gsap.quickTo() for frequently updated properties (e.g. mouse followers)
- Kill or pause off-screen animations; reuse timelines where possible

### gsap-plugins
- Register every used plugin once with gsap.registerPlugin() before any tween/API call
- Do not register inside components that re-render
- ScrollToPlugin for programmatic scroll-to-element without ScrollTrigger
- ScrollSmoother requires specific DOM wrapper structure

### gsap-utils
- Pure helpers on gsap.utils; no registration needed
- Omit last argument to get reusable function (except random — pass true instead)
- Common utils: clamp, mapRange, normalize, interpolate, random, snap, toArray, wrap, pipe

### gsap-frameworks
- Create tweens/ScrollTriggers after DOM is available (onMounted/onMount)
- Kill or revert in unmount cleanup to prevent leaks
- Scope selectors to component root using gsap.context(containerRef)

### ui-ux-pro-max
- Always start with `--design-system` flag for comprehensive recommendations
- Searches 5 domains in parallel: product, style, color, landing, typography
- Applies reasoning rules from ui-reasoning.csv for best matches
- Returns complete design system: pattern, style, colors, typography, effects, anti-patterns

### issue-creation
- Blank issues are disabled; MUST use bug report or feature request template
- Every issue gets `status:needs-review` automatically
- Maintainer MUST add `status:approved` before any PR can be opened
- Questions go to Discussions, not issues

### branch-pr
- Every PR MUST link an approved issue — no exceptions
- Every PR MUST have exactly one `type:*` label
- Branch naming regex: `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)/[a-z0-9._-]+$`
- Automated checks must pass before merge is possible

### judgment-day
- Resolve skills from registry before launching judges; inject compact rules into prompts
- Launch TWO independent blind judge sub-agents via delegate (async, parallel)
- Synthesize verdicts: Confirmed (both), Suspect (one), Contradiction (disagree)
- Apply fixes, then re-judge; escalate after 2 iterations if not resolved

### skill-creator
- Create skill when pattern is repeated, conventions differ from generic best practices, or complex workflows need step-by-step guidance
- Structure: `skills/{name}/SKILL.md` + optional `assets/` and `references/`
- Include frontmatter with name, description, trigger, license, metadata

### go-testing
- Standard Go pattern: table-driven tests with name/input/expected/wantErr
- Use teatest for Bubbletea TUI component testing
- Support golden file testing and integration tests

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md | /Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App/AGENTS.md | Index — references docs/specs/<spec>/ requirements.md, resolve.md, design.md, tasks.md, docs/system/, docs/Prompts/ |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
