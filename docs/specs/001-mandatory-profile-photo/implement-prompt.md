Read AGENTS.md first.

Then read these files:

- docs/specs/001-mandatory-profile-photo/requirements.md
- docs/specs/001-mandatory-profile-photo/design.md
- docs/specs/001-mandatory-profile-photo/tasks.md
- docs/specs/001-mandatory-profile-photo/analysis.md
- docs/specs/001-mandatory-profile-photo/resolve.md

Treat `docs/specs/001-mandatory-profile-photo/requirements.md` and `docs/specs/001-mandatory-profile-photo/resolve.md` as the source of truth.
Treat `docs/specs/001-mandatory-profile-photo/design.md` as the implementation boundary.

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
