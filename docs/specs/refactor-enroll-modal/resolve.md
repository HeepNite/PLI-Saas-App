# Resolve — refactor-enroll-modal

## Decisions

### 1) Logic-first refactor (not extraction-only)
- **Decision**: Prioritize moving decision logic and transitions to pure modules before UI slicing.
- **Why**: Biggest risk is hidden state coupling, not JSX length alone.

### 2) Tests before risky movement
- **Decision**: Add focused tests around helper logic and step-transition decisions before moving high-risk branches.
- **Why**: Prevent behavior drift in check-in/kiosk sign-in/payment edge paths.

### 3) Preserve public exports and caller contract
- **Decision**: Keep `EnrollModal` default export + `formatCheckInSummaryDateTime` + `computeCheckInAutofill` export surface stable.
- **Why**: Existing direct imports/tests depend on these symbols.

### 4) State ownership rules
- **Decision**:
  - consolidate transition-critical flags into explicit flow state (reducer/model)
  - keep ephemeral UI-only flags local when they do not affect transition graph
  - isolate side-effect triggers from pure transition decisions
- **Why**: Reduce implicit temporal coupling across effects.

### 5) useMemo policy (React 19 / Next 15)
- **Decision**: Keep `useMemo` only for expensive derivations or referential stability required by dependency-sensitive hooks/components.
- **Policy**:
  - keep: derived lists/step keys/time slots/calculated URLs where recalculation or identity churn matters
  - remove during apply: memo wrappers around trivial scalars/labels not used for identity-sensitive dependencies
- **Why**: ornamental memoization obscures intent and increases maintenance overhead.

## Boundaries

## What MAY move to pure modules
- check-in date/time/autofill and slot selection logic
- step transition guards (`canContinue`, step validation, next-step resolution)
- checkout payload shaping and response-to-state mapping helpers
- fallback/sign-in decision mappers (without side effects)

## What remains client-interactive in EnrollModal container
- DOM event wiring, timers, network calls, Clerk/Stripe integration, and rendering.

## Unsafe flows to keep intact until covered
- kiosk fast-path auto-advance/auto-submit
- QR polling + completion handoff
- sign-in resume/pending autopay loops
- new-student fallback between sms-verification and regular pricing
