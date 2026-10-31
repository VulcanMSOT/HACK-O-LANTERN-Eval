import { NextResponse } from 'next/server';
import { requireEvaluator } from '@/lib/session';
import { pool } from '@/lib/db';

export async function POST(request) {
  let client;
  try {
    const user = await requireEvaluator();
    const { teamId, roundNumber, value, parameters } = await request.json();

    const cleanTeamId = String(teamId || '').trim();
    const roundNum = Number(roundNumber);
    const numValue = Number(value);

    if (!cleanTeamId) {
      return NextResponse.json({ error: 'Team ID is required.' }, { status: 400 });
    }

    if (isNaN(numValue) || numValue < 0) {
      return NextResponse.json({ error: 'Marks must be a non-negative number.' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Verify round status and max marks
    const roundRes = await client.query(
      'SELECT status, max_marks, evaluators_per_team FROM rounds WHERE round_number = $1 FOR SHARE',
      [roundNum]
    );

    if (roundRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Round not found.' }, { status: 404 });
    }

    const round = roundRes.rows[0];
    if (round.status !== 'open') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'This round is locked and not accepting scores.' }, { status: 400 });
    }

    const maxMarks = Number(round.max_marks);
    const limit = round.evaluators_per_team || 3;

    if (numValue > maxMarks) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: `Marks cannot exceed the maximum of ${maxMarks}.` }, { status: 400 });
    }

    // 2. Lock the team row FOR UPDATE to prevent race conditions across concurrent evaluators
    const teamRes = await client.query(
      'SELECT id, name, status FROM teams WHERE id = $1 FOR UPDATE',
      [cleanTeamId]
    );

    if (teamRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }

    const team = teamRes.rows[0];

    // Final round (Round 4) only permits finalists
    if (roundNum === 4 && team.status !== 'finalist') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Only finalists can be scored in the Final round.' }, { status: 400 });
    }

    if (team.status === 'dropped') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'This team is dropped and cannot be scored.' }, { status: 400 });
    }

    // 3. Check if user has already scored this team in this round
    const existingMarkRes = await client.query(
      'SELECT id, value FROM marks WHERE team_id = $1 AND evaluator_id = $2 AND round_number = $3 AND removed = false',
      [cleanTeamId, user.id, roundNum]
    );

    if (existingMarkRes.rows.length > 0) {
      // Edit existing mark
      const existing = existingMarkRes.rows[0];
      await client.query(
        'UPDATE marks SET value = $1, parameters = $2, updated_at = NOW() WHERE id = $3',
        [numValue, parameters ? JSON.stringify(parameters) : null, existing.id]
      );

      await client.query(
        `INSERT INTO mark_history (mark_id, team_id, evaluator_id, round_number, old_value, new_value, action, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5, $6, 'edit', $7, 'Evaluator updated mark')`,
        [existing.id, cleanTeamId, user.id, roundNum, existing.value, numValue, user.username]
      );

      await client.query('COMMIT');
      return NextResponse.json({
        ok: true,
        action: 'edited',
        message: `Updated mark for ${team.name} to ${numValue}.`,
      });
    }

    // 4. Count existing active marks for this team in this round
    const countRes = await client.query(
      'SELECT COUNT(*)::int as count FROM marks WHERE team_id = $1 AND round_number = $2 AND removed = false',
      [cleanTeamId, roundNum]
    );
    const currentCount = countRes.rows[0].count;

    if (currentCount >= limit) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `This team already has ${limit} evaluators in this round` },
        { status: 409 }
      );
    }

    // 5. Insert new mark
    const insertRes = await client.query(
      `INSERT INTO marks (team_id, evaluator_id, round_number, value, parameters)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [cleanTeamId, user.id, roundNum, numValue, parameters ? JSON.stringify(parameters) : null]
    );

    await client.query(
      `INSERT INTO mark_history (mark_id, team_id, evaluator_id, round_number, old_value, new_value, action, changed_by, reason)
       VALUES ($1, $2, $3, $4, NULL, $5, 'submit', $6, 'Initial evaluation submit')`,
      [insertRes.rows[0].id, cleanTeamId, user.id, roundNum, numValue, user.username]
    );

    await client.query('COMMIT');
    return NextResponse.json({
      ok: true,
      action: 'created',
      message: `Submitted mark of ${numValue} for ${team.name}.`,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Submit mark error:', err);
    return NextResponse.json({ error: err.message || 'Could not submit mark.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

