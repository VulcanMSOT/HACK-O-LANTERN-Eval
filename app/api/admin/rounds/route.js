import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { pool, query } from '@/lib/db';

export async function GET() {
  try {
    await requireAdmin();
    const roundsRes = await query('SELECT * FROM rounds ORDER BY round_number ASC');
    const settingsRes = await query('SELECT * FROM settings WHERE id = 1');
    return NextResponse.json({
      rounds: roundsRes.rows,
      settings: settingsRes.rows[0] || {},
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function POST(request) {
  let client;
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { roundNumber, action, maxMarks, evaluatorsPerTeam, finalRankingRule } = body;

    const roundNum = Number(roundNumber);
    if (!roundNum || roundNum < 1 || roundNum > 4) {
      return NextResponse.json({ error: 'Valid round number (1-4) is required.' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const roundRes = await client.query('SELECT * FROM rounds WHERE round_number = $1 FOR UPDATE', [roundNum]);
    if (roundRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Round not found.' }, { status: 404 });
    }
    const currentRound = roundRes.rows[0];

    // Configure Round
    if (action === 'configure') {
      const parsedMax = maxMarks !== undefined ? (maxMarks === null ? null : Number(maxMarks)) : currentRound.max_marks;
      const parsedEvPerTeam = evaluatorsPerTeam ? Number(evaluatorsPerTeam) : currentRound.evaluators_per_team;

      if (parsedMax !== null && (isNaN(parsedMax) || parsedMax <= 0)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Max marks must be greater than 0.' }, { status: 400 });
      }

      await client.query(
        'UPDATE rounds SET max_marks = $1, evaluators_per_team = $2, updated_at = NOW() WHERE round_number = $3',
        [parsedMax, parsedEvPerTeam, roundNum]
      );

      // If updating Final ranking rule in settings
      if (roundNum === 4 && finalRankingRule) {
        if (!['final_only', 'cumulative'].includes(finalRankingRule)) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: 'Final ranking rule must be either "final_only" or "cumulative".' }, { status: 400 });
        }
        await client.query('UPDATE settings SET final_ranking_rule = $1, updated_at = NOW() WHERE id = 1', [finalRankingRule]);
      }

      await client.query('COMMIT');
      return NextResponse.json({ ok: true, message: `Round ${roundNum} settings updated.` });
    }

    // Open Round
    if (action === 'open') {
      if (!currentRound.max_marks || Number(currentRound.max_marks) <= 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: `Please set max marks for ${currentRound.label} before opening it.` }, { status: 400 });
      }

      // Check Final round specific requirements
      if (roundNum === 4) {
        const settingsRes = await client.query('SELECT final_ranking_rule FROM settings WHERE id = 1');
        const rule = settingsRes.rows[0]?.final_ranking_rule;
        if (!rule) {
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: 'The Final cannot be opened until admin has set both the Final max marks and the final ranking rule setting.',
          }, { status: 400 });
        }
      }

      // Ensure no other round is open at the same time
      await client.query("UPDATE rounds SET status = 'locked', updated_at = NOW() WHERE status = 'open' AND round_number != $1", [roundNum]);

      await client.query("UPDATE rounds SET status = 'open', updated_at = NOW() WHERE round_number = $1", [roundNum]);
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, message: `${currentRound.label} is now OPEN.` });
    }

    // Lock Round
    if (action === 'lock') {
      await client.query("UPDATE rounds SET status = 'locked', updated_at = NOW() WHERE round_number = $1", [roundNum]);
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, message: `${currentRound.label} is now LOCKED.` });
    }

    // Reopen Locked Round (Logged)
    if (action === 'reopen') {
      const reason = String(body.reason || '').trim();
      if (!reason) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'A reason is required to reopen a locked round.' }, { status: 400 });
      }

      await client.query("UPDATE rounds SET status = 'open', updated_at = NOW() WHERE round_number = $1", [roundNum]);

      // Log in mark_history or audit log
      await client.query(
        `INSERT INTO mark_history (team_id, evaluator_id, round_number, action, changed_by, reason)
         VALUES ('VHK-1011', $1, $2, 'reopen_round', $3, $4)`,
        [admin.id, roundNum, admin.username, `Reopened round ${roundNum}: ${reason}`]
      );

      await client.query('COMMIT');
      return NextResponse.json({ ok: true, message: `${currentRound.label} has been REOPENED.` });
    }

    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

