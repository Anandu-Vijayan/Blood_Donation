## Why

Existing blood donor registries expose donor names and phone numbers directly to recipients, creating a serious privacy risk that discourages registration and repeat participation. A privacy-preserving, notification-driven model — similar to how dating apps connect willing participants — can increase donor engagement while ensuring no recipient misses a life-saving opportunity.

## What Changes

- New mobile app (React Native) for blood donation management
- Donors register with blood group, location, and availability; their contact details are never shared until they voluntarily opt in to a specific request
- Recipients post blood requests specifying blood group, units needed, hospital location, and urgency
- Notification system progressively expands geographic radius if no donor accepts within a time window (15 min → 1 hr → region-wide)
- Donors swipe/tap to accept a request; the system then facilitates an anonymous handshake (one-time contact reveal or in-app messaging)
- Post-donation flow: donor marks donation complete and enters a 90-day cooldown, removing them from future notifications during that period
- Backend API (Node.js + PostgreSQL) with push notification infrastructure (FCM/APNs)

## Capabilities

### New Capabilities

- `donor-registration`: Donor onboarding — blood group, location, health eligibility, notification preferences
- `blood-request`: Recipient posts a blood request with group, units, hospital, and urgency level
- `progressive-notification`: Geofenced notification dispatch that expands radius over time until a donor accepts
- `donor-matching`: Matching engine filtering donors by blood group compatibility, cooldown status, and proximity
- `donation-handshake`: Privacy-safe connection between matched donor and recipient (in-app chat or one-time contact reveal)
- `donation-lifecycle`: Donor marks donation done; enforces 90-day cooldown; tracks donation history
- `user-auth`: Phone-number-based authentication (OTP) for both donors and recipients

### Modified Capabilities

## Impact

- New mobile app codebase (React Native, iOS + Android)
- New backend API service and database schema
- Push notification service integration (Firebase Cloud Messaging, APNs)
- No dependency on existing blood bank systems in v1; designed to integrate later
- Privacy-sensitive data: phone numbers stored encrypted, never exposed in API responses until handshake completes
