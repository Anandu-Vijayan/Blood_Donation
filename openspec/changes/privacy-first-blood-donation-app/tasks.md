## 1. Project Scaffolding

- [x] 1.1 Initialise Expo (React Native) project with TypeScript template
- [x] 1.2 Initialise Node.js (Fastify) backend with TypeScript
- [x] 1.3 Set up PostgreSQL with PostGIS extension (Docker Compose for local dev)
- [x] 1.4 Set up Redis for BullMQ job queue (Docker Compose)
- [x] 1.5 Configure ESLint, Prettier, and Husky pre-commit hooks for both apps
- [x] 1.6 Create monorepo structure (e.g., `apps/mobile`, `apps/api`, `packages/shared`)

## 2. Authentication — Clerk Integration

- [ ] 2.1 Create Clerk application and configure phone-number OTP sign-in
- [x] 2.2 Install and configure `@clerk/expo` in the mobile app
- [x] 2.3 Implement Clerk JWT verification middleware in the Fastify backend
- [x] 2.4 Add role-selection screen (Donor / Recipient / Both) shown on first login
- [x] 2.5 Store role selection in the app database linked to Clerk user ID

## 3. Database Schema

- [x] 3.1 Create `donors` table (clerk_user_id, blood_group, location GEOMETRY, availability, last_donated_at, created_at)
- [x] 3.2 Create `blood_requests` table (id, recipient_clerk_id, blood_group, units, hospital_name, hospital_location GEOMETRY, urgency, status, created_at)
- [x] 3.3 Create `notifications_log` table (request_id, donor_id, tier, sent_at)
- [x] 3.4 Create `donations` table (donor_id, request_id, donated_at, blood_group)
- [x] 3.5 Create `handshakes` table (request_id, donor_id, matched_at, cancelled_at)
- [x] 3.6 Add spatial index on `donors.location` and `blood_requests.hospital_location`
- [x] 3.7 Encrypt donor phone number at rest (store via AES-256 before insert)

## 4. Donor Registration API

- [x] 4.1 `POST /donors` — create donor profile (blood group, location, availability)
- [x] 4.2 `PATCH /donors/me/location` — update donor location
- [x] 4.3 `PATCH /donors/me/availability` — toggle donor availability active/inactive
- [x] 4.4 `GET /donors/me` — fetch own donor profile

## 5. Blood Request API

- [x] 5.1 `POST /requests` — create blood request; validate fields; enqueue notification pipeline
- [x] 5.2 `GET /requests/open` — open requests feed filtered by exact blood group, sorted by urgency
- [x] 5.3 `GET /requests/:id` — fetch single request details
- [x] 5.4 `PATCH /requests/:id/status` — recipient marks request fulfilled or unfulfilled

## 6. Progressive Notification Engine

- [x] 6.1 Set up BullMQ queues and workers in the backend
- [x] 6.2 Implement `dispatchNotificationTier(requestId, radiusKm)` — queries eligible donors and sends push notifications
- [x] 6.3 Schedule tier 1 dispatch immediately on request creation
- [x] 6.4 Schedule tier 2 (T+15 min), tier 3 (T+1 hr), tier 4 (T+3 hr) jobs on request creation
- [x] 6.5 Implement job cancellation logic — cancel all pending tier jobs when request is matched
- [x] 6.6 Integrate Expo Push Notification service (FCM + APNs) for push delivery
- [x] 6.7 Track sent notifications in `notifications_log` to prevent duplicate dispatch

## 7. Donor Matching & Handshake API

- [x] 7.1 `POST /requests/:id/accept` — donor accepts request; re-validate eligibility; set status to `matched`; reveal contact details to both parties
- [x] 7.2 `POST /requests/:id/cancel-match` — donor cancels within 30-min window; revert to `open`; resume notification pipeline
- [x] 7.3 Enforce 30-minute cancellation window server-side
- [x] 7.4 Ensure donor phone number is only returned in the accept response, never in list endpoints

## 8. Donation Lifecycle API

- [x] 8.1 `POST /requests/:id/complete` — donor marks donation done; record `last_donated_at`; increment donation count
- [x] 8.2 `GET /donors/me/donations` — return donor's donation history
- [x] 8.3 Enforce 90-day cooldown in all matching/notification queries via SQL WHERE clause

## 9. Mobile App — Donor Flows

- [x] 9.1 Donor registration screen (blood group picker, location permission, availability toggle)
- [x] 9.2 Open requests feed screen (urgency-sorted list, blood group filter)
- [x] 9.3 Request detail screen with "I can donate" CTA and contact-reveal confirmation dialog
- [x] 9.4 Post-match screen showing recipient's name and hospital details
- [x] 9.5 "Mark donation complete" screen
- [x] 9.6 Donation history screen

## 10. Mobile App — Recipient Flows

- [x] 10.1 Post blood request screen (blood group, units, hospital name, location pin, urgency)
- [x] 10.2 My requests list screen with status indicators
- [x] 10.3 Match notification handler — show donor name and phone number on match
- [x] 10.4 Mark request fulfilled / unfulfilled action

## 11. Push Notification Handling (Mobile)

- [x] 11.1 Request push notification permission on first launch
- [x] 11.2 Register Expo push token with backend on login
- [x] 11.3 Handle foreground and background notification payloads
- [x] 11.4 Deep-link notification tap to the relevant request detail screen

## 12. Testing

- [x] 12.1 Unit tests for matching query (cooldown filter, exact blood group filter, radius filter)
- [x] 12.2 Integration tests for progressive notification job scheduling and cancellation
- [x] 12.3 Integration tests for handshake accept/cancel lifecycle
- [x] 12.4 Integration tests for 90-day cooldown enforcement

## 13. Deployment

- [x] 13.1 Dockerise the Fastify API
- [ ] 13.2 Provision PostgreSQL + PostGIS and Redis on hosting (Railway / Render / VPS)
- [ ] 13.3 Set environment variables (Clerk keys, DB URL, Redis URL, FCM credentials)
- [ ] 13.4 Build and submit iOS app via Expo EAS
- [ ] 13.5 Build and submit Android app via Expo EAS
