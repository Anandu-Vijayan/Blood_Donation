import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'reddar-79c00';

function loadCredential() {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    const trimmed = jsonEnv.trim();
    let raw: string | undefined;

    if (trimmed.startsWith('{')) {
      raw = trimmed;
    } else {
      // Try decoding base64 JSON
      try {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
        if (decoded.startsWith('{')) {
          raw = decoded;
        }
      } catch {
        // Not base64
      }

      // If not base64, try reading as a file path
      if (!raw) {
        try {
          raw = readFileSync(trimmed, 'utf8');
        } catch {
          // Not a file path or file unreadable
        }
      }
    }

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (typeof parsed.private_key === 'string') {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return cert(parsed as Parameters<typeof cert>[0]);
      } catch (parseErr) {
        console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseErr);
      }
    }
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      const raw = readFileSync(credPath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return cert(parsed as Parameters<typeof cert>[0]);
    } catch (err) {
      console.error('[Firebase Admin] Failed to read GOOGLE_APPLICATION_CREDENTIALS file:', err);
    }
  }

  return null;
}

function createApp(): App {
  const credential = loadCredential();
  const isProd = process.env.NODE_ENV === 'production';

  if (!credential) {
    console.warn(
      '[Firebase Admin] Warning: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS is not configured or failed to load. Administrative Auth methods (such as deleteUser) will require valid service account credentials.',
    );
  }

  if (isProd && !credential) {
    console.warn(
      '[Firebase Admin] Running in production without service account credentials. User authentication verification will work, but admin calls require FIREBASE_SERVICE_ACCOUNT_JSON.',
    );
  }

  if (credential) {
    return initializeApp({ credential, projectId: PROJECT_ID });
  }

  return initializeApp({ projectId: PROJECT_ID });
}

const app = getApps().length > 0 ? getApps()[0]! : createApp();
export const auth = getAuth(app);
