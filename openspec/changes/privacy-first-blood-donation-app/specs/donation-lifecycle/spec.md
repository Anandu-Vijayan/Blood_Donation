## ADDED Requirements

### Requirement: Donor marks donation complete
After donating, the system SHALL allow a matched donor to mark the donation as complete. This records the donation event and starts the 90-day cooldown.

#### Scenario: Donor marks donation done
- **WHEN** a matched donor marks the donation as complete
- **THEN** the system records `last_donated_at` as the current timestamp and the donor enters the 90-day cooldown

#### Scenario: Cooldown starts immediately
- **WHEN** `last_donated_at` is recorded
- **THEN** the donor is immediately excluded from all new notification dispatches and feed results until `last_donated_at + 90 days`

### Requirement: 90-day cooldown enforcement
The system SHALL enforce the 90-day post-donation cooldown server-side. A donor SHALL NOT be notified about or matched to any request during the cooldown period, regardless of client-side state.

#### Scenario: Cooldown enforced in matching query
- **WHEN** the matching engine queries eligible donors
- **THEN** any donor whose `last_donated_at` is within the last 90 days is excluded at the database query level

#### Scenario: Cooldown expiry restores eligibility
- **WHEN** 90 days have elapsed since `last_donated_at`
- **THEN** the donor is automatically eligible for notification and matching without any manual action

### Requirement: Donation history
The system SHALL maintain a history of completed donations per donor, including the date and the blood group donated.

#### Scenario: Donor views their donation history
- **WHEN** a donor requests their donation history
- **THEN** the system returns a list of past donations with dates and blood groups

### Requirement: Donor's public donation count badge
The system SHALL expose each donor's total confirmed donation count as a non-private badge, visible to recipients after a handshake is completed.

#### Scenario: Donation count increments after completion
- **WHEN** a donor marks a donation complete
- **THEN** their public donation count increments by one
