# migration-domain-ownership Specification

## Purpose

Define coexistence rules for Next and Nest so migration stays reviewable, reversible, and free of dual-writer ambiguity.

## Requirements

### Requirement: Single Writer Per Migrated Domain

The system MUST assign exactly one runtime as the write owner for each migrated subdomain at any point in time.

When a subdomain is still Next-owned, Nest MAY read or orchestrate but MUST NOT persist authoritative writes for that subdomain. Once ownership moves to Nest, Next MUST stop performing those authoritative writes.

#### Scenario: Payment domain still owned by Next

- GIVEN checkout persistence and Stripe webhook side effects have not been migrated
- WHEN Nest participates in the flow
- THEN Next remains the only authoritative writer for payment-side purchase and attendance effects
- AND Nest does not create competing writes for that subdomain

#### Scenario: Migrated subdomain becomes Nest-owned

- GIVEN a subdomain has an approved migration cutover
- WHEN Nest is declared the write owner
- THEN Next stops authoritative writes for that subdomain
- AND rollback instructions identify how ownership returns if needed

### Requirement: Gradual Coexistence and Rollback

The migration MUST proceed in bounded slices and MUST NOT require a full backend rewrite in the first phase.

Shared database access MAY exist temporarily, but every slice MUST state ownership, rollback boundary, and unchanged public contracts before implementation.

#### Scenario: Slice is approved for implementation

- GIVEN a migration slice is proposed for delivery
- WHEN the slice is reviewed
- THEN it identifies the owning runtime, rollback switch, and preserved public contract
- AND it remains compatible with chained delivery

#### Scenario: Slice would create dual-writer ambiguity

- GIVEN a proposed slice leaves both Next and Nest able to perform the same authoritative write
- WHEN the slice is evaluated
- THEN the slice is blocked until ownership is made explicit
- AND implementation does not proceed on ambiguous write behavior
