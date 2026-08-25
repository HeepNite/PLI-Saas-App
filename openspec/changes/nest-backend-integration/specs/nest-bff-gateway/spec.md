# nest-bff-gateway Specification

## Purpose

Keep Next.js as the public backend-for-frontend while selected domains are served by Nest behind unchanged web contracts.

## Requirements

### Requirement: Zero-Rupture Public API Migration

The system MUST keep public web clients on existing Next-owned `/api/*` routes during migration.

For any migrated route, Next MUST preserve the published request shape, response shape, status semantics, auth boundary, and error contract while delegating internal orchestration to Nest.

#### Scenario: Migrated route keeps current contract

- GIVEN a web client calls an existing `/api/*` endpoint selected for migration
- WHEN Next forwards the request to Nest
- THEN the client receives the same externally documented contract as before
- AND the client does not need a URL, cookie, or payload change

#### Scenario: Internal Nest path is unavailable

- GIVEN a migrated endpoint is enabled behind Next
- WHEN the internal Nest dependency is unavailable or disabled for rollback
- THEN traffic is switched back to the Next-owned implementation
- AND the public contract remains unchanged

### Requirement: Next Remains the Initial Public Security Boundary

The system MUST keep Clerk session validation, terminal session validation, and public route exposure in Next for the initial migration slices.

Clients MUST NOT call Nest directly in the first slice.

#### Scenario: Browser request stays on Next boundary

- GIVEN a browser or PWA client performs a check-in or checkout request
- WHEN the request enters the system
- THEN authentication and route admission are enforced by Next first
- AND Nest is reached only through an internal server-to-server path

#### Scenario: First slice excludes direct backend replacement

- GIVEN the migration is in its initial phase
- WHEN a new route is proposed
- THEN it MUST follow the Next-as-BFF pattern
- AND it MUST NOT require a full backend rewrite or direct client-to-Nest adoption
