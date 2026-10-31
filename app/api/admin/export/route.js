import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { pool } from '@/lib/db';
import { calculateStandings } from '@/lib/ranking';

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'standings';

    if (type === 'matrix') {
      const marksRes = await pool.query(`
        SELECT 
          m.id,
          m.round_number,
          t.id AS team_id,
          t.name AS team_name,
          e.username AS evaluator_username,
          e.display_name AS evaluator_name,
          m.value,
          m.created_at,
          m.updated_at
        FROM marks m
        JOIN teams t ON t.id = m.team_id
        JOIN evaluators e ON e.id = m.evaluator_id
        WHERE m.removed = FALSE
        ORDER BY m.round_number ASC, t.id ASC, e.username ASC
      `);

      const headers = ['Mark ID', 'Round', 'Team ID', 'Team Name', 'Evaluator Username', 'Evaluator Name', 'Mark', 'Created At', 'Updated At'];
      const rows = marksRes.rows.map((r) => [
        r.id,
        `Round ${r.round_number}`,
        `"${r.team_id}"`,
        `"${r.team_name.replace(/"/g, '""')}"`,
        `"${r.evaluator_username}"`,
        `"${r.evaluator_name.replace(/"/g, '""')}"`,
        r.value,
        `"${new Date(r.created_at).toISOString()}"`,
        `"${new Date(r.updated_at).toISOString()}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="hackolantern_marks_matrix.csv"',
        },
      });
    }

    // Default: standings CSV
    const [teamsRes, marksRes, roundsRes, settingsRes] = await Promise.all([
      pool.query('SELECT id, name, status FROM teams ORDER BY id ASC'),
      pool.query('SELECT team_id, evaluator_id, round_number, value FROM marks WHERE removed = FALSE'),
      pool.query('SELECT round_number, label, max_marks, evaluators_per_team, status FROM rounds ORDER BY round_number ASC'),
      pool.query('SELECT * FROM settings WHERE id = 1'),
    ]);

    const standings = calculateStandings(teamsRes.rows, marksRes.rows, roundsRes.rows, settingsRes.rows[0] || {});

    const headers = [
      'Rank',
      'Team ID',
      'Team Name',
      'Status',
      'Round 1 Avg',
      'Round 1 Marks Count',
      'Round 2 Avg',
      'Round 2 Marks Count',
      'Round 3 Avg',
      'Round 3 Marks Count',
      'Cumulative R1-R3',
      'Round 4 (Final) Avg',
      'Final Overall Score',
    ];

    const rows = standings.map((s) => [
      s.rank ?? '-',
      `"${s.teamId}"`,
      `"${s.teamName.replace(/"/g, '""')}"`,
      s.status,
      s.roundScores[1] !== null ? s.roundScores[1] : '-',
      s.roundMarkCounts[1],
      s.roundScores[2] !== null ? s.roundScores[2] : '-',
      s.roundMarkCounts[2],
      s.roundScores[3] !== null ? s.roundScores[3] : '-',
      s.roundMarkCounts[3],
      s.cumulativeTotal,
      s.roundScores[4] !== null ? s.roundScores[4] : '-',
      s.finalOverallScore !== null ? s.finalOverallScore : '-',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="hackolantern_standings.csv"',
      },
    });
  } catch (err) {
    console.error('CSV export error:', err);
    return NextResponse.json({ error: err.message || 'Could not export CSV.' }, { status: 500 });
  }
}

