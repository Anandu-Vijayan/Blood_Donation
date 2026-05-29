## ADDED Requirements

### Requirement: Tiered radius notification dispatch
When a blood request is created, the system SHALL dispatch push notifications in expanding geographic tiers until a donor accepts:
- **Tier 1 (T+0)**: donors within 5 km
- **Tier 2 (T+15 min)**: donors within 15 km not yet notified
- **Tier 3 (T+1 hr)**: donors within 50 km not yet notified
- **Tier 4 (T+3 hr)**: all donors in the state/region not yet notified

Each tier SHALL only notify donors not already notified for the same request.

#### Scenario: Tier 1 dispatch on request creation
- **WHEN** a blood request is created
- **THEN** the system immediately notifies all eligible donors within 5 km and schedules tier 2, 3, and 4 jobs

#### Scenario: Tier escalation when no donor accepts
- **WHEN** a tier's notification window elapses with no donor accepting
- **THEN** the system dispatches notifications to the next tier's eligible donors

#### Scenario: Donor already notified is skipped
- **WHEN** a donor was notified in an earlier tier
- **THEN** the system does not send them a duplicate notification in a later tier

### Requirement: Notification cancellation on acceptance
When a donor accepts a request, the system SHALL cancel all pending notification expansion jobs for that request.

#### Scenario: Pending jobs cancelled on match
- **WHEN** a donor accepts a blood request
- **THEN** all scheduled tier expansion jobs for that request are cancelled and no further notifications are sent

### Requirement: Eligible donor filter
A donor is eligible for notification only if all of the following are true: their blood group exactly matches the requested group, they are not in the 90-day post-donation cooldown, their availability is active, and they have not already been notified for this request.

#### Scenario: Cooldown donor excluded
- **WHEN** a donor is within the 90-day post-donation cooldown period
- **THEN** they are excluded from all notification tiers for any request

#### Scenario: Inactive donor excluded
- **WHEN** a donor has set their availability to inactive
- **THEN** they are excluded from all notification dispatch
