import { sql } from './src/db/client.js';

async function run() {
  try {
    await sql`ALTER TABLE blood_requests DROP CONSTRAINT blood_requests_recipient_clerk_id_fkey`;
  } catch(e) {}
  try {
    await sql`ALTER TABLE donors DROP CONSTRAINT donors_clerk_user_id_fkey`;
  } catch(e) {}

  try {
    await sql`ALTER TABLE users RENAME COLUMN clerk_user_id TO firebase_uid`;
    console.log('Renamed users.clerk_user_id to firebase_uid');
  } catch (e) { console.error('Users alter error:', e.message); }

  try {
    await sql`ALTER TABLE donors RENAME COLUMN clerk_user_id TO firebase_uid`;
    console.log('Renamed donors.clerk_user_id to firebase_uid');
  } catch (e) { console.error('Donors alter error:', e.message); }

  try {
    await sql`ALTER TABLE blood_requests RENAME COLUMN recipient_clerk_id TO recipient_firebase_uid`;
    console.log('Renamed blood_requests.recipient_clerk_id to recipient_firebase_uid');
  } catch (e) { console.error('BloodRequests alter error:', e.message); }

  try {
    await sql`ALTER TABLE donors ADD CONSTRAINT donors_firebase_uid_fkey FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid)`;
  } catch(e) {}
  try {
    await sql`ALTER TABLE blood_requests ADD CONSTRAINT blood_requests_recipient_firebase_uid_fkey FOREIGN KEY (recipient_firebase_uid) REFERENCES users(firebase_uid)`;
  } catch(e) {}

  process.exit(0);
}
run();
