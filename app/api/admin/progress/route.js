import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const roundNumber = Number(searchParams.get('round') || 1);

    // 1. Fetch round info
    const roundRes = await query('SELECT * FROM rounds WHERE round_number = $1', [roundNumber]);
    if (roundRes.rows.length === 0) {
      return NextResponse.json({ error: 'Round not found.' }, { status: 404 });
    }
    const round = roundRes.rows[0];
    const limit = round.evaluators_per_team || 3;
    const isFinal = roundNumber === 4;

    // 2. Fetch eligible teams
    const teamsRes = await query(
      isFinal
        ? "SELECT id, name, status FROM teams WHERE status = 'finalist' ORDER BY id ASC"
        : "SELECT id, name, status FROM teams WHERE status != 'dropped' ORDER BY id ASC"
    );
    const teams = teamsRes.rows;

    // 3. Fetch all marks in this round
    const marksRes = await query(
      `SELECT m.team_id, m.evaluator_id, m.value, e.username, e.display_name
       FROM marks m
       JOIN evaluators e ON m.evaluator_id = e.id
       WHERE m.round_number = $1 AND m.removed = false`,
      [roundNumber]
    );
    const marks = marksRes.rows;

    // 4. Calculate total expected vs collected marks
    const totalExpectedMarks = teams.length * limit;
    const totalCollectedMarks = marks.length;

    // 5. Build team coverage map
    const teamMarksMap = new Map();
    marks.forEach((m) => {
      if (!teamMarksMap.has(m.team_id)) teamMarksMap.set(m.team_id, []);
      teamMarksMap.get(m.team_id).push(m);
    });

    const teamProgress = teams.map((t) => {
      const teamMarks = teamMarksMap.get(t.id) || [];
      const collected = teamMarks.length;
      const isComplete = collected >= limit;
      const missingCount = Math.max(0, limit - collected);
      const avg = collected > 0
        ? Math.round((teamMarks.reduce((sum, m) => sum + Number(m.value), 0) / collected) * 100) / 100
        : null;

      return {
        teamId: t.id,
        teamName: t.name,
        status: t.status,
        collected,
        limit,
        isComplete,
        missingCount,
        average: avg,
        evaluators: teamMarks.map((m) => ({
          evaluatorId: m.evaluator_id,
          username: m.username,
          displayName: m.display_name,
          value: Number(m.value),
        })),
      };
    });

    // 6. Build per-evaluator statistics
    const evaluatorsRes = await query('SELECT id, username, display_name FROM evaluators ORDER BY id ASC');
    const evaluatorStats = evaluatorsRes.rows.map((ev) => {
      const evMarks = marks.filter((m) => m.evaluator_id === ev.id).map((m) => Number(m.value));
      const count = evMarks.length;
      if (count === 0) {
        return {
          id: ev.id,
          username: ev.username,
          displayName: ev.display_name,
          teamsScored: 0,
          averageGiven: null,
          minGiven: null,
          maxGiven: null,
          spread: null,
        };
      }

      const sum = evMarks.reduce((a, b) => a + b, 0);
      const avg = Math.round((sum / count) * 100) / 100;
      const min = Math.min(...evMarks);
      const max = Math.max(...evMarks);
      const spread = Math.round((max - min) * 100) / 100;

      return {
        id: ev.id,
        username: ev.username,
        displayName: ev.display_name,
        teamsScored: count,
        averageGiven: avg,
        minGiven: min,
        maxGiven: max,
        spread,
      };
    });

    return NextResponse.json({
      round,
      summary: {
        totalTeams: teams.length,
        totalExpectedMarks,
        totalCollectedMarks,
        percentComplete: totalExpectedMarks > 0 ? Math.round((totalCollectedMarks / totalExpectedMarks) * 100) : 0,
        teamsFullyScored: teamProgress.filter((t) => t.isComplete).length,
        teamsPartiallyScored: teamProgress.filter((t) => t.collected > 0 && !t.isComplete).length,
        teamsUnscored: teamProgress.filter((t) => t.collected === 0).length,
      },
      teamProgress,
      evaluatorStats,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
