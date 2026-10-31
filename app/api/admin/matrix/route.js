import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const roundNumber = Number(searchParams.get('round') || 1);
    const isFinal = roundNumber === 4;

    const [roundsRes, teamsRes, evaluatorsRes, marksRes] = await Promise.all([
      query('SELECT * FROM rounds ORDER BY round_number ASC'),
      query(
        isFinal
          ? "SELECT id, name, status FROM teams WHERE status = 'finalist' ORDER BY id ASC"
          : "SELECT id, name, status FROM teams WHERE status != 'dropped' ORDER BY id ASC"
      ),
      query('SELECT id, username, display_name FROM evaluators ORDER BY id ASC'),
      query(
        `SELECT id, team_id, evaluator_id, round_number, value, removed
         FROM marks
         WHERE round_number = $1 AND removed = false`,
        [roundNumber]
      ),
    ]);

    const evaluators = evaluatorsRes.rows;
    const teams = teamsRes.rows;

    // Build fast lookup map: "teamId:evaluatorId" -> mark
    const marksMap = new Map();
    marksRes.rows.forEach((m) => {
      marksMap.set(`${m.team_id}:${m.evaluator_id}`, {
        id: m.id,
        markId: m.id,
        value: Number(m.value),
      });
    });

    // Build row array expected by frontend: matrix: [ { teamId, teamName, status, marks: [ mark1, mark2, ... ] } ]
    const matrix = teams.map((team) => {
      const marks = evaluators.map((ev) => marksMap.get(`${team.id}:${ev.id}`) || null);
      return {
        teamId: team.id,
        teamName: team.name,
        status: team.status,
        marks,
      };
    });

    return NextResponse.json({
      roundNumber,
      rounds: roundsRes.rows,
      teams,
      evaluators,
      matrix,
      marksLookup: Object.fromEntries(marksMap),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
