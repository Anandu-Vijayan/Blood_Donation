## ADDED Requirements

### Requirement: Clerk-based phone number authentication
The system SHALL use Clerk for all authentication. Users register and log in via phone-number OTP managed entirely by Clerk. The backend SHALL validate Clerk-issued JWTs on every authenticated request and reject requests with missing or invalid tokens.

#### Scenario: New user registers via Clerk
- **WHEN** a new user completes the Clerk phone-number OTP flow in the mobile app
- **THEN** a Clerk user ID is created and the app receives a session token for authenticated API calls

#### Scenario: Returning user logs in
- **WHEN** a returning user completes the Clerk OTP flow
- **THEN** the app receives a valid session token linked to their existing account

#### Scenario: Request with invalid token
- **WHEN** a client sends an API request with a missing or expired JWT
- **THEN** the backend returns HTTP 401 and no data is returned

### Requirement: User role selection post-auth
After first authentication via Clerk, the system SHALL prompt the user to select one or both roles: Donor and/or Recipient. Role selection is stored in the app's own database linked to the Clerk user ID.

#### Scenario: First login role setup
- **WHEN** a newly authenticated user has no role set in the app database
- **THEN** the app prompts them to choose Donor, Recipient, or both before proceeding

#### Scenario: User selects both roles
- **WHEN** a user selects both Donor and Recipient roles
- **THEN** the system creates records for both roles linked to their Clerk user ID
