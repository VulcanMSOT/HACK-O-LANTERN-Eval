import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const roundNumber = Number(searchParams.get('round') || 1);

    const [roundsRes, teamsRes, evaluatorsRes, marksRes] = await Promise.all([
      query('SELECT * FROM rounds ORDER BY round_number ASC'),
      query("SELECT id, name, status FROM teams ORDER BY id ASC"),
      query('SELECT id, username, display_name FROM evaluators ORDER BY id ASC'),
      query(
        `SELECT id, team_id, evaluator_id, round_number, value, removed
         FROM marks
         WHERE round_number = $1 AND removed = false`,
        [roundNumber]
      ),
    ]);

    // Map marks by "teamId:evaluatorId"
    const matrix = {};
    marksRes.rows.forEach((m) => {
      matrix[`${m.team_id}:${m.evaluator_id}`] = {
        markId: m.id,
        value: Number(m.value),
      };
    });

    return NextResponse.json({
      roundNumber,
      rounds: roundsRes.rows,
      teams: teamsRes.rows,
      evaluators: evaluatorsRes.rows,
      matrix,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

