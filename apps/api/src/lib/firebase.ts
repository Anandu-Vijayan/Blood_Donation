import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'reddar-79c00';

function loadCredential() {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    const raw = jsonEnv.trim().startsWith('{')
      ? jsonEnv
      : readFileSync(jsonEnv, 'utf8');
    return cert(JSON.parse(raw) as Parameters<typeof cert>[0]);
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    return cert(JSON.parse(readFileSync(credPath, 'utf8')) as Parameters<typeof cert>[0]);
  }
  return null;
}

function createApp(): App {
  const credential = loadCredential();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !credential) {
    throw new Error(
      'Firebase Admin requires FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in production',
    );
  }

  if (credential) {
    return initializeApp({ credential, projectId: PROJECT_ID });
  }

  return initializeApp({ projectId: PROJECT_ID });
}

const app = getApps().length > 0 ? getApps()[0]! : createApp();
export const auth = getAuth(app);
