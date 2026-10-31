import { NextResponse } from 'next/server';
import { getSessionCookieOptions } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true, message: 'Signed out.' });
  const cookieOptions = getSessionCookieOptions();
  response.cookies.set(cookieOptions.name, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
