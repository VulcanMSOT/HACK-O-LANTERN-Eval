import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [settingsRes, countsRes, teamsRes] = await Promise.all([
      query('SELECT problem_statement_selection_open FROM settings WHERE id = 1'),
      query('SELECT COUNT(*) as count FROM problem_statement_submissions'),
      query('SELECT id, name FROM teams ORDER BY id ASC'),
    ]);

    const isOpen = settingsRes.rows[0]?.problem_statement_selection_open ?? false;
    const submittedCount = Number(countsRes.rows[0]?.count || 0);
    const totalTeams = teamsRes.rows.length;

    return NextResponse.json({
      isOpen,
      submittedCount,
      totalTeams,
      teams: teamsRes.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

