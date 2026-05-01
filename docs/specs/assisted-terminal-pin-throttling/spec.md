# Delta for terminal-pin-auth

## MODIFIED Requirements

### Requirement: PIN Failure Throttling (Assisted Mode)

The system MUST apply a two-tier throttling mechanism when "Assisted Mode" is enabled for a terminal. 

1. **Tier 1 (Credential-specific):** After $N$ failed attempts for a specific credential, the system SHALL impose a short cooldown period (e.g., 2 minutes) specifically for that credential.
2. **Tier 2 (Terminal-wide/Emergency):** If the terminal reaches an extreme threshold of failures across multiple credentials within a defined window, the system MUST trigger the existing terminal-wide block (5 minutes).

(Previously: Terminal-wide block after 5 failed attempts in 10 minutes)

#### Scenario: Successful credential-specific cooldown

- GIVEN a terminal is in "Assisted Mode"
- WHEN a specific user enters an incorrect PIN 3 times within 5 minutes
- THEN the system SHALL allow other users to continue authenticating on the same terminal
- AND the specific user's credentials MUST be throttled for 2 minutes

#### Scenario: Prevention of brute-force via Tier 2 block

- GIVEN a terminal is in "Assisted Mode"
- WHEN the terminal experiences 15 failed attempts across different credentials within 10 minutes
- THEN the system MUST trigger a terminal-wide block for 5 minutes
- AND all authentication attempts on that terminal SHALL be rejected

#### Scenario: Audit Trail Integrity

- GIVEN a PIN failure event occurs (either Tier 1 or Tier 2)
- WHEN the event is processed
- THEN the system MUST log the attempt, including credential ID (if available), terminal ID, and the specific tier of throttling applied.

#### Scenario: Transition to Self-Service (Future Proofing)

- GIVEN a terminal configuration where "Assisted Mode" is DISABLED (Self-service mode)
- WHEN a PIN failure occurs
- THEN the system SHALL revert to the legacy behavior (terminal-wide block after 5 failures in 10 minutes).
