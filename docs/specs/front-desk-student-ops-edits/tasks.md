# Front desk student operational edits - Tasks

## Phase 1 - Analysis

- [x] inspect relevant code paths
- [x] list affected files
- [x] identify conflicts

## Phase 2 - Resolution

- [x] document contract decisions
- [x] confirm source-of-truth behavior

## Phase 3 - Plan

- [x] define minimal implementation order
- [x] identify tests to update or create

## Phase 4 - Implementation

- [x] add focused permission helper for student operational edits
- [x] update card visibility to use the helper-derived permission
- [x] update profile GET/PATCH authorization for allowed student operational edits
- [x] ensure front desk cannot edit staff-management-only fields
- [x] add missing student-data audit writes for operational profile field changes
- [x] reuse existing audited attendance/payment/package/stats flows without duplicating audit code

## Phase 5 - Validation

- [x] verify acceptance criteria
- [x] run relevant tests
- [ ] document residual risks

## Already Covered By Existing Code

- [x] student-data audit records store actor fields (`staffClerkId`, `staffName`)
- [x] attendance add/remove/update flows write student-data audit entries
- [x] settlement mark-paid/pending routes already allow `staff + front_desk`
- [x] audit-log responses expose actor fields for review
