import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { teamId, teamName, problemStatement, trackNumber, action } = body;

    const cleanTeamId = String(teamId || '').trim();
    if (!cleanTeamId) {
      return NextResponse.json({ error: 'Team ID is required.' }, { status: 400 });
    }

    // 1. Verify team exists
    const teamRes = await query('SELECT id, name FROM teams WHERE id = $1', [cleanTeamId]);
    if (teamRes.rows.length === 0) {
      return NextResponse.json({ error: `Team ${cleanTeamId} not found.` }, { status: 404 });
    }

    // 2. If teamName is being updated
    if (teamName && teamName.trim() && teamName.trim() !== teamRes.rows[0].name) {
      const cleanName = teamName.trim();
      const norm = cleanName.toLowerCase().replace(/\s+/g, '');
      await query('UPDATE teams SET name = $1, normalised_name = $2, updated_at = NOW() WHERE id = $3', [
        cleanName,
        norm,
        cleanTeamId,
      ]);
    }

    // 3. If action is 'clear' (reset back to Pending)
    if (action === 'clear') {
      await query('DELETE FROM problem_statement_submissions WHERE team_id = $1', [cleanTeamId]);
      return NextResponse.json({
        success: true,
        message: `Cleared problem statement submission for ${cleanTeamId}. Status reset to Pending.`,
      });
    }

    // 4. Update / Upsert problem statement
    const statementText = String(problemStatement || '').trim();
    if (!statementText) {
      return NextResponse.json({ error: 'Problem statement text cannot be empty.' }, { status: 400 });
    }

    const trackNum = trackNumber !== undefined && trackNumber !== null && trackNumber !== '' ? Number(trackNumber) : null;

    const res = await query(
      `INSERT INTO problem_statement_submissions (team_id, problem_statement, track_number, submitted_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (team_id) DO UPDATE SET
         problem_statement = EXCLUDED.problem_statement,
         track_number = EXCLUDED.track_number,
         updated_at = NOW()
       RETURNING *`,
      [cleanTeamId, statementText, trackNum]
    );

    return NextResponse.json({
      success: true,
      message: `Updated details for ${cleanTeamId}!`,
      submission: res.rows[0],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to update details.' }, { status: 500 });
  }
}

