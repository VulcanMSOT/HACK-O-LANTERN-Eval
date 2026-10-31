import { NextResponse } from 'next/server';
import { requireEvaluator } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const user = await requireEvaluator();

    // Fetch all rounds
    const roundsRes = await query(
      'SELECT round_number, label, max_marks, evaluators_per_team, status FROM rounds ORDER BY round_number ASC'
    );
    const rounds = roundsRes.rows;
    const openRound = rounds.find((r) => r.status === 'open') || null;

    let userScoredCount = 0;
    if (openRound) {
      const countRes = await query(
        'SELECT COUNT(*)::int as count FROM marks WHERE evaluator_id = $1 AND round_number = $2 AND removed = false',
        [user.id, openRound.round_number]
      );
      userScoredCount = countRes.rows[0].count;
    }

    return NextResponse.json({
      rounds,
      openRound,
      userScoredCount,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

