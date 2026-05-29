## ADDED Requirements

### Requirement: Exact blood group matching
The system SHALL match donors to requests based on exact blood group only. No cross-type compatibility rules are applied in v1.

#### Scenario: Exact match found
- **WHEN** a blood request is posted for blood group B+
- **THEN** only donors registered as B+ are considered eligible

#### Scenario: No exact match available
- **WHEN** no active, cooldown-free donors with the exact requested blood group exist within any notification tier
- **THEN** the system completes all tiers without a match and the request remains open

### Requirement: Proximity-based donor ranking within a tier
Within each notification tier, eligible donors SHALL be ordered by proximity to the request's hospital location (nearest first) for dispatch ordering purposes.

#### Scenario: Nearest donor notified first within tier
- **WHEN** multiple eligible donors exist within a tier's radius
- **THEN** push notifications are dispatched in order of proximity, nearest first

### Requirement: Donor state validation at match time
Before confirming a donor's acceptance, the system SHALL re-validate that the donor is still eligible (not in cooldown, still active). If validation fails, the acceptance is rejected and the request remains open.

#### Scenario: Donor enters cooldown between notification and acceptance
- **WHEN** a donor who received a notification is now in cooldown when they attempt to accept
- **THEN** the system rejects their acceptance and the request remains in open status
