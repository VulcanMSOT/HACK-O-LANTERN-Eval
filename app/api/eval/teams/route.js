import { NextResponse } from 'next/server';
import { requireEvaluator } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    const user = await requireEvaluator();
    const { searchParams } = new URL(request.url);
    const roundNumber = Number(searchParams.get('round') || 1);

    const roundRes = await query(
      'SELECT round_number, label, max_marks, evaluators_per_team, status, parameters FROM rounds WHERE round_number = $1',
      [roundNumber]
    );

    const round = roundRes.rows[0] || null;
    if (!round) {
      return NextResponse.json({ round: null, teams: [] });
    }

    const isFinal = round.round_number === 4;
    const limit = round.evaluators_per_team || 3;

    // 2. Fetch eligible teams
    const teamsQuery = isFinal
      ? `SELECT t.id, t.name, t.normalised_name, t.status, pss.problem_statement, pss.track_number
         FROM teams t
         LEFT JOIN problem_statement_submissions pss ON t.id = pss.team_id
         WHERE t.status = 'finalist' ORDER BY t.id ASC`
      : `SELECT t.id, t.name, t.normalised_name, t.status, pss.problem_statement, pss.track_number
         FROM teams t
         LEFT JOIN problem_statement_submissions pss ON t.id = pss.team_id
         WHERE t.status != 'dropped' ORDER BY t.id ASC`;

    const teamsRes = await query(teamsQuery);
    const teams = teamsRes.rows;

    // 3. Fetch marks for this round to compute slot counts and user's mark
    const marksRes = await query(
      `SELECT team_id, evaluator_id, value, parameters
       FROM marks
       WHERE round_number = $1 AND removed = false`,
      [round.round_number]
    );

    const teamMarksCount = new Map();
    const userMarks = new Map();

    marksRes.rows.forEach((m) => {
      teamMarksCount.set(m.team_id, (teamMarksCount.get(m.team_id) || 0) + 1);
      if (m.evaluator_id === user.id) {
        userMarks.set(m.team_id, { value: Number(m.value), parameters: m.parameters });
      }
    });

    const enrichedTeams = teams.map((t) => {
      const scoredCount = teamMarksCount.get(t.id) || 0;
      const userScored = userMarks.has(t.id);
      const userMarkData = userScored ? userMarks.get(t.id) : null;
      const userMark = userMarkData ? userMarkData.value : null;
      const isFull = scoredCount >= limit;
      const canScore = !userScored && !isFull;

      return {
        id: t.id,
        name: t.name,
        normalised_name: t.normalised_name,
        problemStatement: t.problem_statement,
        trackNumber: t.track_number,
        status: t.status,
        scoredCount,
        marksCount: scoredCount,
        limit,
        userScored,
        userMark,
        myScore: userScored ? { value: userMark, parameters: userMarkData?.parameters } : null,
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
      round,
      openRound: round,
      teams: enrichedTeams,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

