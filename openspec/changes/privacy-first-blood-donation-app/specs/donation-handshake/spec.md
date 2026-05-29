## ADDED Requirements

### Requirement: Donor accepts a request
The system SHALL allow a donor to accept an open blood request. On acceptance, the request is locked to that donor and both parties' contact details are revealed to each other.

#### Scenario: Successful acceptance
- **WHEN** an eligible donor accepts an open blood request
- **THEN** the request status changes to `matched`, the recipient receives the donor's full name and phone number, and the donor receives the recipient's name and hospital location details

#### Scenario: Donor accepts an already-matched request
- **WHEN** a donor attempts to accept a request that another donor has already accepted
- **THEN** the system rejects the acceptance with an appropriate message and the requesting donor is informed the need has been filled

#### Scenario: Ineligible donor attempts acceptance
- **WHEN** a donor in cooldown or with inactive status attempts to accept a request
- **THEN** the system rejects the acceptance and returns a validation error

### Requirement: Donor cancels after acceptance
A matched donor MAY cancel their acceptance within 30 minutes of matching. Cancellation after 30 minutes is not permitted via the app; the recipient must mark it unfulfilled instead.

#### Scenario: Donor cancels within 30-minute window
- **WHEN** a matched donor cancels within 30 minutes of their acceptance
- **THEN** the request reverts to `open` status, the notification pipeline resumes from the last dispatched tier, and the recipient is notified of the cancellation

#### Scenario: Donor attempts to cancel after 30-minute window
- **WHEN** a matched donor attempts to cancel more than 30 minutes after acceptance
- **THEN** the system rejects the cancellation; the recipient must resolve the request

### Requirement: Contact details are never pre-revealed
The system SHALL never return a donor's phone number or full name in any API response before a handshake is completed.

#### Scenario: Recipient queries nearby donors before match
- **WHEN** a recipient or any unauthenticated party queries donor data
- **THEN** the API returns only anonymized fields (blood group, approximate distance, donation count) and no contact details
