import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query } from './db.js';

const SESSION_COOKIE_NAME = 'hackolantern_eval_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const SECRET = process.env.SESSION_SECRET || 'hackolantern_default_fallback_secret_32char';

function sign(payload) {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createSessionToken(evaluator) {
  const payload = Buffer.from(
    JSON.stringify({
      id: evaluator.id,
      username: evaluator.username,
      displayName: evaluator.display_name,
      role: evaluator.role,
      exp: Date.now() + SESSION_DURATION_MS,
    })
  ).toString('base64url');

  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expectedSignature = sign(payload);

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function loginEvaluator(usernameInput, passwordInput) {
  const cleanUsername = String(usernameInput || '').trim().toLowerCase();
  const cleanPassword = String(passwordInput || '');

  const genericError = 'Invalid username or password.';

  if (!cleanUsername || !cleanPassword) {
    return { ok: false, error: genericError };
  }

  const res = await query(
    'SELECT id, username, display_name, role, password_hash, failed_attempts, locked_until FROM evaluators WHERE username = $1',
    [cleanUsername]
  );

  if (res.rows.length === 0) {
    // Run dummy compare to mitigate timing attacks
    await bcrypt.compare(cleanPassword, '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr');
    return { ok: false, error: genericError };
  }

  const evaluator = res.rows[0];

  // Check if locked
  if (evaluator.locked_until && new Date(evaluator.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(evaluator.locked_until).getTime() - Date.now()) / 60000);
    return {
      ok: false,
      error: `Account temporarily locked due to repeated failed attempts. Please try again in ${minutesLeft} minute(s).`,
    };
  }

  const passwordValid = await bcrypt.compare(cleanPassword, evaluator.password_hash);

  if (!passwordValid) {
    const attempts = (evaluator.failed_attempts || 0) + 1;
    let lockedUntil = null;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await query(
      'UPDATE evaluators SET failed_attempts = $1, locked_until = $2 WHERE id = $3',
      [attempts, lockedUntil, evaluator.id]
    );

    if (lockedUntil) {
      return {
        ok: false,
        error: `Too many wrong attempts. Account locked for 15 minutes.`,
      };
    }

    return { ok: false, error: genericError };
  }

  // Reset failed attempts upon successful login
  await query('UPDATE evaluators SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [evaluator.id]);

  const token = createSessionToken(evaluator);
  return {
    ok: true,
    evaluator: {
      id: evaluator.id,
      username: evaluator.username,
      displayName: evaluator.display_name,
      role: evaluator.role,
    },
    token,
  };
}

export function getSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60, // 12 hours in seconds
  };
}
