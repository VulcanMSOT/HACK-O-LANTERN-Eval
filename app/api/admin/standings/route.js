import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { pool } from '@/lib/db';
import { calculateStandings } from '@/lib/ranking';

export async function GET() {
  try {
    await requireAdmin();

    const [teamsRes, marksRes, roundsRes, settingsRes] = await Promise.all([
      pool.query('SELECT id, name, status FROM teams ORDER BY id ASC'),
      pool.query('SELECT team_id, evaluator_id, round_number, value FROM marks WHERE removed = FALSE'),
      pool.query('SELECT round_number, label, max_marks, evaluators_per_team, status FROM rounds ORDER BY round_number ASC'),
      pool.query('SELECT * FROM settings WHERE id = 1'),
    ]);

    const teams = teamsRes.rows;
    const marks = marksRes.rows;
    const rounds = roundsRes.rows;
    const settings = settingsRes.rows[0] || {};

    const standings = calculateStandings(teams, marks, rounds, settings);

    // Check for ties at cut (default top 10)
    const cutN = Number(settings.number_of_finalists || 10);
    let tieAtCut = null;
    if (standings.length >= cutN + 1) {
      const teamAtCut = standings[cutN - 1]; // e.g. 10th
      const teamAfterCut = standings[cutN];   // e.g. 11th
      if (teamAtCut && teamAfterCut && teamAtCut.rank === teamAfterCut.rank) {
        const tiedRank = teamAtCut.rank;
        const tiedTeams = standings.filter((t) => t.rank === tiedRank);
        tieAtCut = {
          rank: tiedRank,
          teams: tiedTeams.map((t) => ({ id: t.teamId, name: t.teamName, total: t.cumulativeTotal })),
        };
      }
    }

    // Check teams missing marks in Rounds 1-3
    const incompleteTeamsR1toR3 = standings.filter((t) => {
      return !t.roundComplete[1] || !t.roundComplete[2] || !t.roundComplete[3];
    });

    return NextResponse.json({
      standings,
      rounds,
      settings,
      tieAtCut,
      incompleteTeams: incompleteTeamsR1toR3.map((t) => ({
        id: t.teamId,
        name: t.teamName,
        r1: t.roundMarkCounts[1],
        r2: t.roundMarkCounts[2],
        r3: t.roundMarkCounts[3],
      })),
    });
  } catch (err) {
    console.error('Admin standings error:', err);
    return NextResponse.json({ error: err.message || 'Could not fetch standings.' }, { status: 500 });
  }
}

