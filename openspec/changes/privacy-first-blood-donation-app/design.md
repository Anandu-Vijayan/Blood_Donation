## Context

No existing codebase. This is a greenfield mobile app backed by a new API service. The core design constraint is privacy: donor contact details must never be visible to recipients until a donor actively opts in by accepting a request. The secondary constraint is reliability — a recipient must never miss an opportunity due to notification delivery failure or donor unresponsiveness.

Blood group compatibility (e.g., O- can donate to all groups) is a known static mapping and will be baked into the matching engine.

## Goals / Non-Goals

**Goals:**
- Donor privacy by default — phone numbers and names are never returned in API responses to recipients until a donor accepts
- Reliable notification delivery with progressive geographic expansion
- 90-day post-donation cooldown enforced server-side, not just client-side
- Stateless, scalable backend suitable for a region (e.g., a city or state)
- Works offline for non-critical flows; critical flows (accepting a request) require connectivity

**Non-Goals:**
- In-app chat or messaging between donor and recipient (v1: contact reveal only)
- Integration with government blood bank databases in v1
- Blood inventory management or hospital-side workflows
- Payment or incentive systems
- Web app (mobile-only in v1)

## Decisions

### 1. Tech Stack

**Mobile**: React Native (Expo managed workflow)
- Rationale: single codebase for iOS and Android; Expo simplifies OTA updates and push notification setup.
- Alternative considered: Flutter — rejected due to JS/TS team familiarity advantage.

**Backend**: Node.js (Fastify) + PostgreSQL
- Rationale: Fastify is fast and schema-first; PostgreSQL has PostGIS for geospatial queries needed for radius expansion.
- Alternative considered: Firebase — rejected because server-side cooldown enforcement and radius expansion scheduling are awkward in Firebase Functions.

**Push Notifications**: Firebase Cloud Messaging (FCM) for Android, APNs for iOS, via Expo Push Notification service.

**Auth**: Clerk — handles phone-number OTP, session tokens, and JWT verification out of the box. No custom auth code needed; backend validates Clerk-issued JWTs on every request.

### 2. Privacy Model

Donor phone numbers are stored encrypted at rest (AES-256). The API never returns donor contact details in search results or notification payloads. Contact is revealed **only** when a donor taps "I can donate" — at that point the recipient receives the donor's name and phone number. No intermediate step; no opt-out after accepting.

Recipient sees before acceptance: donor's blood group, approximate distance (rounded to nearest km), and donation count badge only.

### 3. Progressive Notification Architecture

When a blood request is posted:
1. **T+0**: notify donors within 5 km radius
2. **T+15 min**: if no donor accepted, expand to 15 km
3. **T+1 hr**: expand to 50 km
4. **T+3 hr**: notify all donors in the state/region

Implementation: a job queue (BullMQ + Redis) schedules expansion jobs at request creation time. Each job queries for eligible donors (correct blood group, not in cooldown, within radius, not already notified for this request) and dispatches push notifications.

If a donor accepts before the next expansion fires, all pending expansion jobs for that request are cancelled.

### 4. Donor-Recipient Handshake

When a donor taps "I can donate":
- Request moves to `matched` status (no further notifications sent)
- Recipient is immediately notified and shown the donor's name and phone number
- Donor is shown the recipient's name and hospital/location details

One request can only be matched to one donor at a time. If the matched donor cancels within 30 minutes, the request reverts to `open` and the expansion scheduler resumes from the last radius tier.

### 5. Blood Group Compatibility

Matching is exact — donors are notified only if their blood group exactly matches the requested group. No cross-type compatibility in v1; this keeps the matching logic simple and avoids confusion for recipients who may have been told a specific group is needed.

### 6. Cooldown Enforcement

After a donor marks a donation complete, the backend sets `last_donated_at`. The donor is excluded from all matching queries until `last_donated_at + 90 days`. This is enforced in the SQL WHERE clause, not in application logic, to prevent client-side bypass.

## Risks / Trade-offs

- **Notification delivery failure** → Mitigation: track FCM delivery receipts; retry undelivered once. Add a "nearby open requests" pull feed in the app (sorted by urgency) as a fallback discovery mechanism.
- **Matched donor doesn't show up** → Mitigation: recipient can mark request unfulfilled after handshake, which reopens it and resumes expansion from the last tier. Repeated no-shows flag the donor account for review.
- **Contact reveal is irreversible** → Mitigation: make the "I can donate" confirmation screen explicit with a warning that their phone number will be shared. This is the intended UX trade-off for v1 simplicity.
- **PostGIS radius queries at scale** → Mitigation: spatial index on donor location; cache query results for short TTL; horizontal scaling of read replicas.
- **Privacy breach if server is compromised** → Mitigation: encryption at rest for phone numbers; no plaintext PII in application logs; audit log for all handshake events.

## Migration Plan

Greenfield — no migration needed. Deployment:
1. Provision PostgreSQL (with PostGIS) + Redis
2. Deploy backend API (Docker container)
3. Submit mobile app to App Store / Play Store
4. Pilot with a small cohort before public launch

Rollback: stateless backend — roll back Docker image tag. Mobile: Expo OTA for JS patches; store rollout controls for native changes.

## Open Questions

- Clerk pricing tier — confirm free tier limits are sufficient for pilot, or budget for Growth plan
- How is "urgency" defined for sorting the open requests feed? (Proposed: time since posted + units needed, weighted — to be confirmed)
