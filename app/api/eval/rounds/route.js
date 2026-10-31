import { NextResponse } from 'next/server';
import { requireEvaluator } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const user = await requireEvaluator();

    // Fetch the open round (if any)
    const openRes = await query(
      'SELECT round_number, label, max_marks, evaluators_per_team, status FROM rounds WHERE status = $1 ORDER BY round_number ASC LIMIT 1',
      ['open']
    );

    const openRound = openRes.rows[0] || null;

    let userScoredCount = 0;
    if (openRound) {
      const countRes = await query(
        'SELECT COUNT(*)::int as count FROM marks WHERE evaluator_id = $1 AND round_number = $2 AND removed = false',
        [user.id, openRound.round_number]
      );
      userScoredCount = countRes.rows[0].count;
    }

    return NextResponse.json({
      openRound,
      userScoredCount,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
