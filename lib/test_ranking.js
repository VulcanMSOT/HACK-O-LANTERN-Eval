import { calculateStandings } from './ranking.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASSED: ${message}`);
}

function runTests() {
  console.log('=== RUNNING AUTOMATED TESTS FOR RANKING ENGINE ===\n');

  const sampleRounds = [
    { round_number: 1, evaluators_per_team: 3, max_marks: 10 },
    { round_number: 2, evaluators_per_team: 3, max_marks: 10 },
    { round_number: 3, evaluators_per_team: 3, max_marks: 10 },
    { round_number: 4, evaluators_per_team: 3, max_marks: 10 },
  ];

  const sampleTeams = [
    { id: 'T1', name: 'Alpha', status: 'active' },
    { id: 'T2', name: 'Beta', status: 'active' },
    { id: 'T3', name: 'Gamma', status: 'active' },
    { id: 'T4', name: 'Delta (Unscored)', status: 'active' },
  ];

  // Test 1: Standard Averages and Cumulative Ranking
  const marks1 = [
    // T1: R1 = [8, 9, 7] (avg 8), R2 = [10, 10, 10] (avg 10), R3 = [9, 9, 9] (avg 9) -> Total = 27
    { team_id: 'T1', round_number: 1, value: 8 },
    { team_id: 'T1', round_number: 1, value: 9 },
    { team_id: 'T1', round_number: 1, value: 7 },
    { team_id: 'T1', round_number: 2, value: 10 },
    { team_id: 'T1', round_number: 2, value: 10 },
    { team_id: 'T1', round_number: 2, value: 10 },
    { team_id: 'T1', round_number: 3, value: 9 },
    { team_id: 'T1', round_number: 3, value: 9 },
    { team_id: 'T1', round_number: 3, value: 9 },

    // T2: R1 = [6, 6, 6] (avg 6), R2 = [7, 7, 7] (avg 7), R3 = [8, 8, 8] (avg 8) -> Total = 21
    { team_id: 'T2', round_number: 1, value: 6 },
    { team_id: 'T2', round_number: 1, value: 6 },
    { team_id: 'T2', round_number: 1, value: 6 },
    { team_id: 'T2', round_number: 2, value: 7 },
    { team_id: 'T2', round_number: 2, value: 7 },
    { team_id: 'T2', round_number: 2, value: 7 },
    { team_id: 'T2', round_number: 3, value: 8 },
    { team_id: 'T2', round_number: 3, value: 8 },
    { team_id: 'T2', round_number: 3, value: 8 },

    // T3: Partial submission (only 2 evaluators in R1: [8, 8] -> avg 8, R2: [8, 8] -> avg 8, R3: [5, 5] -> avg 5) -> Total = 21
    { team_id: 'T3', round_number: 1, value: 8 },
    { team_id: 'T3', round_number: 1, value: 8 },
    { team_id: 'T3', round_number: 2, value: 8 },
    { team_id: 'T3', round_number: 2, value: 8 },
    { team_id: 'T3', round_number: 3, value: 5 },
    { team_id: 'T3', round_number: 3, value: 5 },
  ];

  const res1 = calculateStandings(sampleTeams, marks1, sampleRounds, {
    round_weights: { '1': 1, '2': 1, '3': 1 },
    tie_break_order: [3, 2, 1],
  });

  // Verification 1: T1 has rank 1 and total 27
  assert(res1[0].teamId === 'T1' && res1[0].rank === 1 && res1[0].cumulativeTotal === 27, 'T1 is rank 1 with 27 total');

  // Verification 2: Tie break between T2 and T3 (both have 21 total, but T2 has R3 score 8 vs T3 R3 score 5)
  assert(res1[1].teamId === 'T2' && res1[1].cumulativeTotal === 21, 'T2 breaks tie over T3 via higher Round 3 score (8 vs 5)');
  assert(res1[2].teamId === 'T3' && res1[2].cumulativeTotal === 21, 'T3 is placed after T2');

  // Verification 3: Unscored team T4 has rank null and is at the end
  assert(res1[3].teamId === 'T4' && res1[3].rank === null, 'Unscored team T4 has rank = null and is at end');

  // Test 2: Standard Competition Ranking for Exact Ties (e.g. 1, 2, 2, 4)
  const tiedTeams = [
    { id: 'T_A', name: 'Team A', status: 'active' },
    { id: 'T_B', name: 'Team B', status: 'active' },
    { id: 'T_C', name: 'Team C', status: 'active' },
  ];
  const tiedMarks = [
    { team_id: 'T_A', round_number: 1, value: 10 },
    { team_id: 'T_B', round_number: 1, value: 8 },
    { team_id: 'T_C', round_number: 1, value: 8 },
  ];
  const resTied = calculateStandings(tiedTeams, tiedMarks, sampleRounds);
  assert(resTied[0].rank === 1 && resTied[0].teamId === 'T_A', 'T_A is rank 1');
  assert(resTied[1].rank === 2 && resTied[2].rank === 2, 'T_B and T_C share rank 2 for exact tie');

  // Test 3: Finalist Ranking Rules
  const finalTeams = [
    { id: 'F1', name: 'Finalist 1', status: 'finalist' },
    { id: 'F2', name: 'Finalist 2', status: 'finalist' },
  ];
  const finalMarks = [
    // F1: R1-R3 total = 25, Final (R4) = 8
    { team_id: 'F1', round_number: 1, value: 25 },
    { team_id: 'F1', round_number: 4, value: 8 },
    // F2: R1-R3 total = 20, Final (R4) = 9.5
    { team_id: 'F2', round_number: 1, value: 20 },
    { team_id: 'F2', round_number: 4, value: 9.5 },
  ];

  // Rule A: final_only -> F2 should win because R4 is 9.5 vs 8
  const resFinalOnly = calculateStandings(finalTeams, finalMarks, sampleRounds, {
    final_ranking_rule: 'final_only',
  });
  assert(resFinalOnly[0].teamId === 'F2' && resFinalOnly[0].rank === 1, 'final_only rule ranks F2 #1 with higher final score (9.5 vs 8)');

  // Rule B: cumulative (with weight 1.0) -> F1 total = 25 + 8 = 33 vs F2 total = 20 + 9.5 = 29.5 -> F1 wins
  const resCumulative = calculateStandings(finalTeams, finalMarks, sampleRounds, {
    final_ranking_rule: 'cumulative',
    final_weight: 1.0,
  });
  assert(resCumulative[0].teamId === 'F1' && resCumulative[0].rank === 1, 'cumulative rule ranks F1 #1 with higher overall total (33 vs 29.5)');

  console.log('\n🎉 ALL MATHEMATICAL RANKING TESTS PASSED!');
}

runTests();

