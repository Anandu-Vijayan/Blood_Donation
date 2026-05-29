## ADDED Requirements

### Requirement: Donor profile creation
The system SHALL allow an authenticated user to register as a donor by providing their blood group, current location, and notification preferences. The donor's phone number is sourced from Clerk and stored encrypted; it is never exposed in API responses until a handshake is accepted.

#### Scenario: Successful donor registration
- **WHEN** an authenticated user submits a valid blood group and location
- **THEN** the system creates a donor profile and marks it as active

#### Scenario: Duplicate donor registration
- **WHEN** an authenticated user who already has a donor profile attempts to register again
- **THEN** the system returns the existing profile and does not create a duplicate

#### Scenario: Invalid blood group submitted
- **WHEN** a user submits a blood group value not in the valid set (A+, A-, B+, B-, AB+, AB-, O+, O-)
- **THEN** the system rejects the request with a validation error

### Requirement: Donor location update
The system SHALL allow a donor to update their location at any time. Location is used for proximity-based notification targeting.

#### Scenario: Donor updates location
- **WHEN** a donor submits a new latitude/longitude
- **THEN** the system updates their stored location and the new location is used for future matching

### Requirement: Donor availability toggle
The system SHALL allow a donor to mark themselves as unavailable, pausing all notifications without deleting their profile.

#### Scenario: Donor marks unavailable
- **WHEN** a donor sets their availability to inactive
- **THEN** the system excludes them from all future notification dispatch until they reactivate

#### Scenario: Donor reactivates
- **WHEN** an inactive donor sets their availability back to active
- **THEN** the system includes them in future notification dispatch immediately
