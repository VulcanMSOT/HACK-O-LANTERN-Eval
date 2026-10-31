import { NextResponse } from 'next/server';
import { requireEvaluator } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const user = await requireEvaluator();

    // 1. Get open round
    const openRes = await query(
      'SELECT round_number, label, max_marks, evaluators_per_team, status FROM rounds WHERE status = $1 ORDER BY round_number ASC LIMIT 1',
      ['open']
    );

    if (openRes.rows.length === 0) {
      return NextResponse.json({
        openRound: null,
        teams: [],
      });
    }

    const openRound = openRes.rows[0];
    const isFinal = openRound.round_number === 4;
    const limit = openRound.evaluators_per_team || 3;

    // 2. Fetch eligible teams
    const teamsQuery = isFinal
      ? "SELECT id, name, status FROM teams WHERE status = 'finalist' ORDER BY id ASC"
      : "SELECT id, name, status FROM teams WHERE status != 'dropped' ORDER BY id ASC";

    const teamsRes = await query(teamsQuery);
    const teams = teamsRes.rows;

    // 3. Fetch marks for this round to compute slot counts and user's mark
    const marksRes = await query(
      `SELECT team_id, evaluator_id, value
       FROM marks
       WHERE round_number = $1 AND removed = false`,
      [openRound.round_number]
    );

    const teamMarksCount = new Map();
    const userMarks = new Map();

    marksRes.rows.forEach((m) => {
      teamMarksCount.set(m.team_id, (teamMarksCount.get(m.team_id) || 0) + 1);
      if (m.evaluator_id === user.id) {
        userMarks.set(m.team_id, Number(m.value));
      }
    });

    const enrichedTeams = teams.map((t) => {
      const scoredCount = teamMarksCount.get(t.id) || 0;
      const userScored = userMarks.has(t.id);
      const userMark = userScored ? userMarks.get(t.id) : null;
      const isFull = scoredCount >= limit;
      const canScore = !userScored && !isFull;

      return {
        id: t.id,
        name: t.name,
        status: t.status,
        scoredCount,
        limit,
        userScored,
        userMark,
        isFull,
        canScore,
      };
    });

    // 4. Sort:
    // Category 1: Can score (unscored by user & not full), sorted by fewest marks first (asc)
    // Category 2: Full teams (unscored by user)
    // Category 3: Already scored by user (available for edit)
    enrichedTeams.sort((a, b) => {
      if (a.canScore && !b.canScore) return -1;
      if (!a.canScore && b.canScore) return 1;

      if (a.canScore && b.canScore) {
        if (a.scoredCount !== b.scoredCount) {
          return a.scoredCount - b.scoredCount; // Fewest marks first!
        }
        return a.id.localeCompare(b.id);
      }

      if (a.userScored && !b.userScored) return 1; // already scored placed at bottom
      if (!a.userScored && b.userScored) return -1;

      return a.id.localeCompare(b.id);
    });

    return NextResponse.json({
      openRound,
      teams: enrichedTeams,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
