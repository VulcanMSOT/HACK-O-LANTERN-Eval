import { NextResponse } from 'next/server';
import { loginEvaluator, getSessionCookieOptions } from '@/lib/auth';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const result = await loginEvaluator(username, password);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({
      ok: true,
      evaluator: result.evaluator,
    });

    const cookieOptions = getSessionCookieOptions();
    response.cookies.set(cookieOptions.name, result.token, cookieOptions);

    return response;
  } catch (err) {
    console.error('Login route error:', err);
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 500 });
  }
}

