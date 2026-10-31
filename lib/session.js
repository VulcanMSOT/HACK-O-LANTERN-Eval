import { cookies } from 'next/headers';
import { verifySessionToken } from './auth.js';

export async function getCurrentEvaluator() {
  const cookieStore = await cookies();
  const token = cookieStore.get('hackolantern_eval_session')?.value;
  return verifySessionToken(token);
}

export async function requireEvaluator() {
  const user = await getCurrentEvaluator();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireEvaluator();
  if (user.role !== 'admin' && user.username !== 'sapnil') {
    throw new Error('Admin authorization required');
  }
  return user;
}
