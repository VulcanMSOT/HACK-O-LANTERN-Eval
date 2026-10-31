/**
 * Pure calculation functions for Hack-O-Lantern 2026 scoring and ranking.
 * Shared between Admin view, exports, and the public Leaderboard API.
 */

/**
 * Calculates round averages and completion status for teams.
 * @param {Array} teams - Array of team objects [{ id, name, status }]
 * @param {Array} marks - Array of active mark objects [{ team_id, round_number, value }]
 * @param {Array} rounds - Array of round objects [{ round_number, evaluators_per_team, max_marks }]
 * @param {Object} settings - Event settings { round_weights, final_weight, final_ranking_rule, tie_break_order }
 */
export function calculateStandings(teams, marks, rounds, settings = {}) {
  const roundWeights = settings.round_weights || { '1': 1, '2': 1, '3': 1 };
  const finalWeight = Number(settings.final_weight ?? 1.0);
  const finalRule = settings.final_ranking_rule || 'final_only';
  const tieBreakOrder = settings.tie_break_order || [3, 2, 1];

  const roundMap = new Map();
  rounds.forEach((r) => roundMap.set(r.round_number, r));

  // 1. Group marks by team_id and round_number
  const teamMarksMap = new Map();
  marks.forEach((m) => {
    if (m.removed) return;
    const key = `${m.team_id}:${m.round_number}`;
    if (!teamMarksMap.has(key)) teamMarksMap.set(key, []);
    teamMarksMap.get(key).push(Number(m.value));
  });

  // 2. Compute round averages and cumulative totals for each team
  const computedTeams = teams.map((team) => {
    const roundScores = {};
    const roundMarkCounts = {};
    const roundComplete = {};

    let cumulativeTotal = 0;
    let hasAnyMarks = false;

    // Rounds 1, 2, 3
    for (let r = 1; r <= 3; r++) {
      const rObj = roundMap.get(r) || { evaluators_per_team: 3 };
      const teamRoundMarks = teamMarksMap.get(`${team.id}:${r}`) || [];
      roundMarkCounts[r] = teamRoundMarks.length;
      roundComplete[r] = teamRoundMarks.length >= (rObj.evaluators_per_team || 3);

      if (teamRoundMarks.length > 0) {
        hasAnyMarks = true;
        const avg = teamRoundMarks.reduce((a, b) => a + b, 0) / teamRoundMarks.length;
        roundScores[r] = Math.round(avg * 100) / 100;
        const weight = Number(roundWeights[String(r)] ?? 1);
        cumulativeTotal += roundScores[r] * weight;
      } else {
        roundScores[r] = null;
      }
    }

    // Round 4 (Final)
    const r4Obj = roundMap.get(4) || { evaluators_per_team: 3 };
    const finalMarks = teamMarksMap.get(`${team.id}:4`) || [];
    roundMarkCounts[4] = finalMarks.length;
    roundComplete[4] = finalMarks.length >= (r4Obj.evaluators_per_team || 3);

    if (finalMarks.length > 0) {
      hasAnyMarks = true;
      const avg = finalMarks.reduce((a, b) => a + b, 0) / finalMarks.length;
      roundScores[4] = Math.round(avg * 100) / 100;
    } else {
      roundScores[4] = null;
    }

    cumulativeTotal = Math.round(cumulativeTotal * 100) / 100;

    // Final Stage Total
    let finalOverallScore = null;
    if (roundScores[4] !== null) {
      if (finalRule === 'cumulative') {
        finalOverallScore = Math.round((cumulativeTotal + roundScores[4] * finalWeight) * 100) / 100;
      } else {
        finalOverallScore = roundScores[4];
      }
    }

    return {
      teamId: team.id,
      teamName: team.name,
      status: team.status, // 'active' | 'finalist' | 'dropped'
      hasAnyMarks,
      roundScores,
      roundMarkCounts,
      roundComplete,
      cumulativeTotal,
      finalOverallScore,
    };
  });

  // 3. Sorting & Ranking Logic
  // Are there finalists with scores in Round 4?
  const hasFinalScores = computedTeams.some((t) => t.status === 'finalist' && t.roundScores[4] !== null);

  function compareRounds1To3(a, b) {
    if (b.cumulativeTotal !== a.cumulativeTotal) {
      return b.cumulativeTotal - a.cumulativeTotal;
    }
    // Tie-break order
    for (const rNum of tieBreakOrder) {
      const scoreA = a.roundScores[rNum] ?? -1;
      const scoreB = b.roundScores[rNum] ?? -1;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
    }
    return a.teamId.localeCompare(b.teamId);
  }

  function compareFinalists(a, b) {
    if (finalRule === 'final_only') {
      const fA = a.roundScores[4] ?? -1;
      const fB = b.roundScores[4] ?? -1;
      if (fB !== fA) return fB - fA;
      // Tie break by cumulative R1-R3, then by R3, R2, R1
      return compareRounds1To3(a, b);
    } else {
      // cumulative rule
      const tA = a.finalOverallScore ?? a.cumulativeTotal;
      const tB = b.finalOverallScore ?? b.cumulativeTotal;
      if (tB !== tA) return tB - tA;
      return compareRounds1To3(a, b);
    }
  }

  // Partition teams into scored vs unscored
  const scoredTeams = computedTeams.filter((t) => t.hasAnyMarks);
  const unscoredTeams = computedTeams.filter((t) => !t.hasAnyMarks);

  // Sort unscored teams by team ID with rank = null
  unscoredTeams.sort((a, b) => a.teamId.localeCompare(b.teamId));
  unscoredTeams.forEach((t) => {
    t.rank = null;
  });

  let rankedScoredTeams = [];

  if (hasFinalScores) {
    // Finalists first, followed by non-finalists
    const finalists = scoredTeams.filter((t) => t.status === 'finalist');
    const nonFinalists = scoredTeams.filter((t) => t.status !== 'finalist');

    finalists.sort(compareFinalists);
    nonFinalists.sort(compareRounds1To3);

    // Apply Standard Competition Ranking for finalists (1, 2, 2, 4...)
    let currentRank = 1;
    finalists.forEach((t, idx) => {
      if (idx > 0) {
        const prev = finalists[idx - 1];
        const isTie = finalRule === 'final_only'
          ? t.roundScores[4] === prev.roundScores[4] && t.cumulativeTotal === prev.cumulativeTotal
          : t.finalOverallScore === prev.finalOverallScore;

        if (!isTie) {
          currentRank = idx + 1;
        }
      }
      t.rank = currentRank;
    });

    // Continue ranking for non-finalists starting after finalists
    let nonFinRank = finalists.length + 1;
    nonFinalists.forEach((t, idx) => {
      if (idx > 0) {
        const prev = nonFinalists[idx - 1];
        if (t.cumulativeTotal !== prev.cumulativeTotal) {
          nonFinRank = finalists.length + idx + 1;
        }
      }
      t.rank = nonFinRank;
    });

    rankedScoredTeams = [...finalists, ...nonFinalists];
  } else {
    // Normal Rounds 1 to 3
    scoredTeams.sort(compareRounds1To3);

    let currentRank = 1;
    scoredTeams.forEach((t, idx) => {
      if (idx > 0) {
        const prev = scoredTeams[idx - 1];
        if (t.cumulativeTotal !== prev.cumulativeTotal) {
          currentRank = idx + 1;
        }
      }
      t.rank = currentRank;
    });

    rankedScoredTeams = scoredTeams;
  }

  return [...rankedScoredTeams, ...unscoredTeams];
}
