import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET() {
  try {
    await requireAdmin();

    const [settingsRes, teamsRes] = await Promise.all([
      query('SELECT problem_statement_selection_open FROM settings WHERE id = 1'),
      query(`
        SELECT 
          t.id, 
          t.name, 
          t.status,
          pss.id AS submission_id,
          pss.problem_statement,
          pss.track_number,
          pss.submitted_at
        FROM teams t
        LEFT JOIN problem_statement_submissions pss ON t.id = pss.team_id
        ORDER BY 
          CASE WHEN pss.id IS NOT NULL THEN 0 ELSE 1 END,
          t.id ASC
      `),
    ]);

    const isOpen = settingsRes.rows[0]?.problem_statement_selection_open ?? false;
    const teams = teamsRes.rows;
    const totalTeams = teams.length;
    const submittedCount = teams.filter((t) => t.submission_id !== null).length;
    const unsubmittedCount = totalTeams - submittedCount;

    return NextResponse.json({
      isOpen,
      totalTeams,
      submittedCount,
      unsubmittedCount,
      teams,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
