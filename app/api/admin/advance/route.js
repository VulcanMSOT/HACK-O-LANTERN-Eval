import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { pool } from '@/lib/db';
import { calculateStandings } from '@/lib/ranking';

export async function POST(request) {
  let client;
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { action, reason, overrideIncomplete, selectedTiedTeamIds, restoreTeamId } = body;

    const cleanReason = String(reason || '').trim();
    if (!cleanReason) {
      return NextResponse.json({ error: 'A reason is required for this action.' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // 1. UNDO ADVANCEMENT
    if (action === 'undo') {
      // Check if Final (Round 4) has opened
      const r4Res = await client.query('SELECT status FROM rounds WHERE round_number = 4');
      if (r4Res.rows[0]?.status === 'open') {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Cannot undo advancement after the Final round has opened.' }, { status: 400 });
      }

      // Reset all teams back to active
      await client.query("UPDATE teams SET status = 'active', updated_at = NOW()");

      await client.query(
        `INSERT INTO mark_history (team_id, evaluator_id, round_number, action, changed_by, reason)
         VALUES ('ALL', $1, 4, 'undo_advancement', $2, $3)`,
        [admin.id, admin.username, cleanReason]
      ).catch(() => {}); // Optional audit record

      await client.query('COMMIT');
      return NextResponse.json({ ok: true, message: 'Advancement undone. All teams restored to active.' });
    }

    // 2. RESTORE DROPPED TEAM
    if (action === 'restore') {
      const cleanTeamId = String(restoreTeamId || '').trim();
      if (!cleanTeamId) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Team ID is required to restore.' }, { status: 400 });
      }

      await client.query("UPDATE teams SET status = 'active', updated_at = NOW() WHERE id = $1", [cleanTeamId]);

      await client.query(
        `INSERT INTO mark_history (team_id, evaluator_id, round_number, action, changed_by, reason)
         VALUES ($1, $2, 4, 'restore_dropped', $3, $4)`,
        [cleanTeamId, admin.id, admin.username, cleanReason]
      );

      await client.query('COMMIT');
      return NextResponse.json({ ok: true, message: `Team ${cleanTeamId} restored to active.` });
    }

    // 3. ADVANCE TOP N
    if (action === 'advance') {
      // Must verify Round 3 is locked
      const r3Res = await client.query('SELECT status FROM rounds WHERE round_number = 3');
      if (r3Res.rows[0]?.status !== 'locked') {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Round 3 must be locked before advancing teams.' }, { status: 400 });
      }

      // Fetch teams, marks, rounds, settings
      const [teamsRes, marksRes, roundsRes, settingsRes] = await Promise.all([
        client.query('SELECT id, name, status FROM teams'),
        client.query('SELECT team_id, evaluator_id, round_number, value FROM marks WHERE removed = FALSE'),
        client.query('SELECT round_number, label, max_marks, evaluators_per_team, status FROM rounds'),
        client.query('SELECT * FROM settings WHERE id = 1'),
      ]);

      const teams = teamsRes.rows;
      const marks = marksRes.rows;
      const rounds = roundsRes.rows;
      const settings = settingsRes.rows[0] || {};
      const cutN = Number(settings.number_of_finalists || 10);

      const standings = calculateStandings(teams, marks, rounds, settings);

      // Check incomplete
      const incomplete = standings.filter((t) => !t.roundComplete[1] || !t.roundComplete[2] || !t.roundComplete[3]);
      if (incomplete.length > 0 && !overrideIncomplete) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          error: 'incomplete_teams',
          message: `${incomplete.length} teams have missing marks in Rounds 1-3. Confirmation required.`,
          incompleteTeams: incomplete.map((t) => ({ id: t.teamId, name: t.teamName })),
        }, { status: 400 });
      }

      // Check tie at cut
      let finalistIds = [];
      const teamAtCut = standings[cutN - 1];
      const teamAfterCut = standings[cutN];

      if (teamAtCut && teamAfterCut && teamAtCut.rank === teamAfterCut.rank) {
        // Tied at the cut line!
        const tiedRank = teamAtCut.rank;
        const tiedTeams = standings.filter((t) => t.rank === tiedRank);

        if (!selectedTiedTeamIds) {
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: 'tie_at_cut',
            message: `Tie detected at rank ${tiedRank}. Please specify which tied teams to advance or advance all tied teams.`,
            tiedTeams: tiedTeams.map((t) => ({ id: t.teamId, name: t.teamName, rank: t.rank, score: t.cumulativeTotal })),
          }, { status: 400 });
        }

        // Admin made decision
        if (selectedTiedTeamIds === 'all') {
          // Advance all tied teams
          const higherTeams = standings.filter((t) => t.rank < tiedRank).map((t) => t.teamId);
          finalistIds = [...higherTeams, ...tiedTeams.map((t) => t.teamId)];
        } else if (Array.isArray(selectedTiedTeamIds)) {
          const higherTeams = standings.filter((t) => t.rank < tiedRank).map((t) => t.teamId);
          finalistIds = [...higherTeams, ...selectedTiedTeamIds];
        }
      } else {
        // Clear cut
        finalistIds = standings.slice(0, cutN).map((t) => t.teamId);
      }

      // Update statuses
      for (const t of teams) {
        const isFinalist = finalistIds.includes(t.id);
        const newStatus = isFinalist ? 'finalist' : 'dropped';
        await client.query('UPDATE teams SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, t.id]);
        
        await client.query(
          `INSERT INTO mark_history (team_id, evaluator_id, round_number, action, changed_by, reason)
           VALUES ($1, $2, 4, $3, $4, $5)`,
          [t.id, admin.id, isFinalist ? 'advanced_finalist' : 'dropped_from_finals', admin.username, cleanReason]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({
        ok: true,
        message: `Advanced ${finalistIds.length} teams to the Final round.`,
        finalistsCount: finalistIds.length,
      });
    }

    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Advance error:', err);
    return NextResponse.json({ error: err.message || 'Could not process advancement.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

