import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { pool } from '@/lib/db';

export async function POST(request) {
  let client;
  try {
    const admin = await requireAdmin();
    const { teamId, evaluatorId, roundNumber, value, reason } = await request.json();

    const cleanTeamId = String(teamId || '').trim();
    const evalId = Number(evaluatorId);
    const roundNum = Number(roundNumber);
    const numValue = Number(value);
    const cleanReason = String(reason || '').trim();

    if (!cleanTeamId || !evalId || !roundNum || isNaN(numValue) || numValue < 0) {
      return NextResponse.json({ error: 'Team, evaluator, round, and valid non-negative mark are required.' }, { status: 400 });
    }

    if (!cleanReason) {
      return NextResponse.json({ error: 'A reason is required when entering marks on behalf of an evaluator.' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Verify round
    const roundRes = await client.query(
      'SELECT status, max_marks, evaluators_per_team FROM rounds WHERE round_number = $1 FOR SHARE',
      [roundNum]
    );
    if (roundRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Round not found.' }, { status: 404 });
    }
    const round = roundRes.rows[0];
    const maxMarks = Number(round.max_marks || 100);
    const limit = round.evaluators_per_team || 3;

    if (numValue > maxMarks) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: `Mark cannot exceed round maximum of ${maxMarks}.` }, { status: 400 });
    }

    // Lock team
    const teamRes = await client.query('SELECT id, name, status FROM teams WHERE id = $1 FOR UPDATE', [cleanTeamId]);
    if (teamRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }
    const team = teamRes.rows[0];

    // Check if evaluator already scored
    const existingMark = await client.query(
      'SELECT id, value FROM marks WHERE team_id = $1 AND evaluator_id = $2 AND round_number = $3',
      [cleanTeamId, evalId, roundNum]
    );

    if (existingMark.rows.length > 0) {
      const existing = existingMark.rows[0];
      await client.query('UPDATE marks SET value = $1, removed = FALSE, updated_at = NOW() WHERE id = $2', [numValue, existing.id]);
      await client.query(
        `INSERT INTO mark_history (mark_id, team_id, evaluator_id, round_number, old_value, new_value, action, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5, $6, 'admin_enter_behalf', $7, $8)`,
        [existing.id, cleanTeamId, evalId, roundNum, existing.value, numValue, admin.username, cleanReason]
      );
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, message: `Updated mark for ${team.name}.` });
    }

    // Check team count limit
    const countRes = await client.query(
      'SELECT COUNT(*)::int as count FROM marks WHERE team_id = $1 AND round_number = $2 AND removed = FALSE',
      [cleanTeamId, roundNum]
    );
    if (countRes.rows[0].count >= limit) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: `This team already has ${limit} evaluators in this round.` }, { status: 409 });
    }

    const insRes = await client.query(
      `INSERT INTO marks (team_id, evaluator_id, round_number, value)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [cleanTeamId, evalId, roundNum, numValue]
    );

    await client.query(
      `INSERT INTO mark_history (mark_id, team_id, evaluator_id, round_number, old_value, new_value, action, changed_by, reason)
       VALUES ($1, $2, $3, $4, NULL, $5, 'admin_enter_behalf', $6, $7)`,
      [insRes.rows[0].id, cleanTeamId, evalId, roundNum, numValue, admin.username, cleanReason]
    );

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, message: `Entered mark for ${team.name}.` });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Admin enter mark error:', err);
    return NextResponse.json({ error: err.message || 'Could not enter mark.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

