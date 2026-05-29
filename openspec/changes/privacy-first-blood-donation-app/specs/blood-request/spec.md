## ADDED Requirements

### Requirement: Blood request creation
The system SHALL allow an authenticated recipient to post a blood request specifying the required blood group, number of units, hospital name, hospital location, and an urgency level. On creation the system SHALL immediately trigger the progressive notification pipeline.

#### Scenario: Successful request creation
- **WHEN** a recipient submits a complete blood request with valid fields
- **THEN** the system creates a request in `open` status, records the timestamp, and enqueues the notification pipeline

#### Scenario: Request with invalid blood group
- **WHEN** a recipient submits a blood group not in the valid set
- **THEN** the system rejects the request with a validation error and does not create a request

### Requirement: Blood request status lifecycle
A blood request SHALL progress through the following statuses: `open` → `matched` → `fulfilled` or `unfulfilled`. Only the recipient who created the request may mark it fulfilled or unfulfilled.

#### Scenario: Request moves to matched
- **WHEN** a donor accepts the request
- **THEN** the system sets the request status to `matched` and cancels pending expansion jobs

#### Scenario: Recipient marks request fulfilled
- **WHEN** the recipient marks the request as fulfilled after donation
- **THEN** the system sets status to `fulfilled` and closes the request

#### Scenario: Recipient marks request unfulfilled
- **WHEN** the recipient marks the request as unfulfilled (donor did not show up)
- **THEN** the system sets status back to `open` and resumes the notification pipeline from the last radius tier

### Requirement: Open requests feed
The system SHALL provide a feed of open blood requests visible to donors matching by exact blood group, sorted by urgency descending. Only requests within the donor's region SHALL be shown.

#### Scenario: Donor views urgency-sorted feed
- **WHEN** a donor opens the open requests feed
- **THEN** the system returns open requests matching the donor's exact blood group, sorted by urgency score descending

#### Scenario: No matching requests
- **WHEN** there are no open requests for the donor's blood group in their region
- **THEN** the system returns an empty list with no error
