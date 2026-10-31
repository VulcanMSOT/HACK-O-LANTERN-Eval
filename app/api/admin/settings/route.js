import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { pool } from '@/lib/db';
import { calculateStandings } from '@/lib/ranking';

export async function GET() {
  try {
    await requireAdmin();
    const res = await pool.query('SELECT * FROM settings WHERE id = 1');
    return NextResponse.json({ settings: res.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not fetch settings.' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await requireAdmin();
    const body = await request.json();

    const allowedFields = [
      'leaderboard_mode',
      'leaderboard_scope',
      'final_ranking_rule',
      'final_weight',
      'number_of_finalists',
    ];

    const currentRes = await pool.query('SELECT * FROM settings WHERE id = 1');
    const current = currentRes.rows[0] || {};

    let frozenSnapshot = current.frozen_snapshot;

    // If switching to frozen, snapshot current leaderboard state
    if (body.leaderboard_mode === 'frozen' && current.leaderboard_mode !== 'frozen') {
      const [teamsRes, marksRes, roundsRes] = await Promise.all([
        pool.query('SELECT id, name, status FROM teams'),
        pool.query('SELECT team_id, evaluator_id, round_number, value FROM marks WHERE removed = FALSE'),
        pool.query('SELECT round_number, label, max_marks, evaluators_per_team, status FROM rounds'),
      ]);
      const standings = calculateStandings(teamsRes.rows, marksRes.rows, roundsRes.rows, current);
      // Filter scope
      const scope = body.leaderboard_scope || current.leaderboard_scope;
      const filtered = scope === 'finalists_only'
        ? standings.filter((s) => s.status === 'finalist')
        : standings;
      frozenSnapshot = JSON.stringify(
        filtered.map((s) => ({ rank: s.rank, teamId: s.teamId, teamName: s.teamName }))
      );
    }

    const updates = [];
    const values = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(body[field]);
      }
    }

    if (body.leaderboard_mode === 'frozen') {
      updates.push(`frozen_snapshot = $${idx++}`);
      values.push(frozenSnapshot);
    }

    if (updates.length === 0) {
      return NextResponse.json({ ok: true, settings: current });
    }

    updates.push(`updated_at = NOW()`);

    const query = `UPDATE settings SET ${updates.join(', ')} WHERE id = 1 RETURNING *`;
    const updateRes = await pool.query(query, values);

    return NextResponse.json({ ok: true, settings: updateRes.rows[0] });
  } catch (err) {
    console.error('Settings update error:', err);
    return NextResponse.json({ error: err.message || 'Could not update settings.' }, { status: 500 });
  }
}
