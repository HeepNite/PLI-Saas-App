# Tasks: Security and Observability Hardening

## Execution Order

- [x] 1. **Contain local credentials** — add the narrow `.scratch-prod/` ignore rule; after rotation readiness, remove stale local secret copies without reading values; verify Git tracking/status safely. (ODD task 2)
- [ ] 2. **Prepare provider rotation** — confirm the authoritative Railway service and identify both Vercel consumer records by scope; agree approved development/production verification paths and rollback owner. (ODD task 3)
- [ ] 3. **Rotate and verify database access** — an authorized operator regenerates through Railway, updates both Vercel consumers privately, redeploys, and records redacted status evidence for both approved paths. (ODD task 3)
- [x] 4. **Implement Sentry delivery** — add explicit release/environment identity, build source-map/release upload under secure metadata, global error capture, and non-duplicating route-boundary behavior; preserve DSN gating and 0.1 sampling. Add focused tests. (ODD task 4)
- [ ] 5. **Provision and audit Sentry** — obtain scoped remote access, configure minimum alert ownership, send one safe tagged test event, and verify remote ingestion, release, environment, and symbolication. (ODD tasks 4–5)
- [x] 6. **Add preventive scanning** — add the repository-owned redacting CI scan and focused validation that it detects only documented high-confidence secret candidates without disclosing values or scanning provider secrets. (ODD task 2)
- [ ] 7. **Validate and close** — run authorized focused tests, typecheck, build, secret scan, and deployment checks; record skipped/unavailable remote checks and rollback/incident evidence. (ODD task 5)

## Completion Evidence

Each task records command/provider status and non-secret identifiers only. No task is complete on configuration intent alone: provider mutations require deployment or remote verification evidence, and repository changes require their focused checks.

Repository evidence for task 4: focused runtime-configuration and boundary-capture tests passed without a DSN or token. The no-credential build-config import passed with Sentry upload credentials unset. Build gating exports the plain Next config unless deterministic release plus Sentry auth/org/project metadata are all present; focused tests verify the wrapper is then called with the explicit release deploy options. Remote provisioning, release upload, ingestion, and symbolication remain task 5 evidence.
