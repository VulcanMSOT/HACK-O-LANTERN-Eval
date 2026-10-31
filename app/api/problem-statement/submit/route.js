import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    // 1. Check if problem statement selection is currently OPEN
    const settingsRes = await query('SELECT problem_statement_selection_open FROM settings WHERE id = 1');
    const isOpen = settingsRes.rows[0]?.problem_statement_selection_open ?? false;

    if (!isOpen) {
      return NextResponse.json(
        {
          error:
            'Problem Statement Selection is currently CLOSED. Submissions are not allowed at this time. Please wait for organizers to announce the selection window.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const teamId = String(body.teamId || '').trim();
    const problemStatement = String(body.problemStatement || '').trim();
    const trackNumber = body.trackNumber ? Number(body.trackNumber) : null;

    if (!teamId) {
      return NextResponse.json({ error: 'Please select your Team ID.' }, { status: 400 });
    }

    if (!problemStatement || problemStatement.length < 3) {
      return NextResponse.json({ error: 'Please enter or select a valid problem statement.' }, { status: 400 });
    }

    // 2. Validate team exists
    const teamRes = await query('SELECT id, name FROM teams WHERE id = $1', [teamId]);
    if (teamRes.rows.length === 0) {
      return NextResponse.json({ error: `Team ${teamId} not found in roster.` }, { status: 404 });
    }
    const team = teamRes.rows[0];

    // 3. Upsert submission
    const res = await query(
      `INSERT INTO problem_statement_submissions (team_id, problem_statement, track_number, submitted_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (team_id) DO UPDATE SET
         problem_statement = EXCLUDED.problem_statement,
         track_number = EXCLUDED.track_number,
         updated_at = NOW()
       RETURNING *`,
      [team.id, problemStatement, trackNumber]
    );

    return NextResponse.json({
      success: true,
      message: `Problem statement successfully recorded for ${team.name} (${team.id})!`,
      submission: res.rows[0],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Submission failed.' }, { status: 500 });
  }
}
