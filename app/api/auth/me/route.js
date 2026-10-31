import { NextResponse } from 'next/server';
import { getCurrentEvaluator } from '@/lib/session';

export async function GET() {
  const user = await getCurrentEvaluator();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
    evaluator: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
}

