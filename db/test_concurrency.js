import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// Helper simulating an evaluator atomic submission route
async function submitMarkAtomic({ teamId, evaluatorId, roundNumber, value }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check round status and max marks
    const roundRes = await client.query(
      'SELECT status, max_marks, evaluators_per_team FROM rounds WHERE round_number = $1 FOR SHARE',
      [roundNumber]
    );
    if (!roundRes.rows.length || roundRes.rows[0].status !== 'open') {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Round is not open for scoring.' };
    }
    const maxMarks = Number(roundRes.rows[0].max_marks);
    const limit = roundRes.rows[0].evaluators_per_team || 3;

    if (value < 0 || value > maxMarks) {
      await client.query('ROLLBACK');
      return { ok: false, error: `Marks must be between 0 and ${maxMarks}.` };
    }

    // 2. Lock the team row FOR UPDATE to serialize concurrent evaluator checks for this team
    const teamLock = await client.query('SELECT id, status FROM teams WHERE id = $1 FOR UPDATE', [teamId]);
    if (!teamLock.rows.length || teamLock.rows[0].status === 'dropped') {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Team not eligible for this round.' };
    }

    // 3. Check if THIS evaluator already scored this team in this round
    const existing = await client.query(
      'SELECT id, value FROM marks WHERE team_id = $1 AND evaluator_id = $2 AND round_number = $3 AND removed = false',
      [teamId, evaluatorId, roundNumber]
    );

    if (existing.rows.length > 0) {
      // Edit own mark
      await client.query(
        'UPDATE marks SET value = $1, updated_at = NOW() WHERE id = $2',
        [value, existing.rows[0].id]
      );
      await client.query(
        `INSERT INTO mark_history (mark_id, team_id, evaluator_id, round_number, old_value, new_value, action, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5, $6, 'edit', (SELECT username FROM evaluators WHERE id = $3), 'Evaluator updated mark')`,
        [existing.rows[0].id, teamId, evaluatorId, roundNumber, existing.rows[0].value, value]
      );
      await client.query('COMMIT');
      return { ok: true, action: 'edited' };
    }

    // 4. Count existing active marks for this team in this round
    const countRes = await client.query(
      'SELECT COUNT(*)::int as count FROM marks WHERE team_id = $1 AND round_number = $2 AND removed = false',
      [teamId, roundNumber]
    );
    const currentCount = countRes.rows[0].count;

    if (currentCount >= limit) {
      await client.query('ROLLBACK');
      return { ok: false, error: `This team already has ${limit} evaluators in this round` };
    }

    // 5. Insert mark
    const insertRes = await client.query(
      `INSERT INTO marks (team_id, evaluator_id, round_number, value)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [teamId, evaluatorId, roundNumber, value]
    );

    await client.query(
      `INSERT INTO mark_history (mark_id, team_id, evaluator_id, round_number, old_value, new_value, action, changed_by, reason)
       VALUES ($1, $2, $3, $4, NULL, $5, 'submit', (SELECT username FROM evaluators WHERE id = $3), 'Initial evaluation submit')`,
      [insertRes.rows[0].id, teamId, evaluatorId, roundNumber, value]
    );

    await client.query('COMMIT');
    return { ok: true, action: 'created' };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, error: err.message };
  } finally {
    client.release();
  }
}

async function runTest() {
  console.log('=== TESTING ATOMIC 3-EVALUATOR CONCURRENCY LIMIT ===\n');

  // Setup: Temporarily open Round 1 with max_marks = 10, evaluators_per_team = 3
  await pool.query("UPDATE rounds SET status = 'open', max_marks = 10 WHERE round_number = 1");

  // Clean up any test marks on team VHK-1011
  const testTeamId = 'VHK-1011';
  await pool.query('DELETE FROM marks WHERE team_id = $1', [testTeamId]);
  await pool.query('DELETE FROM mark_history WHERE team_id = $1', [testTeamId]);

  // Fetch 4 evaluator IDs
  const evRes = await pool.query('SELECT id, username FROM evaluators ORDER BY id ASC LIMIT 4');
  const evaluators = evRes.rows;
  console.log(`Testing with 4 evaluators: ${evaluators.map((e) => e.username).join(', ')}`);

  console.log(`\nSimulating 4 evaluators simultaneously submitting marks for team ${testTeamId}...`);

  // Launch 4 simultaneous promises
  const promises = evaluators.map((ev, index) =>
    submitMarkAtomic({
      teamId: testTeamId,
      evaluatorId: ev.id,
      roundNumber: 1,
      value: 7.5 + index * 0.5,
    })
  );

  const results = await Promise.all(promises);

  console.log('\nResults from simultaneous submissions:');
  results.forEach((res, index) => {
    console.log(`  Evaluator ${evaluators[index].username}: ${res.ok ? '✓ Succeeded' : '✗ REFUSED: ' + res.error}`);
  });

  const successes = results.filter((r) => r.ok).length;
  const refused = results.filter((r) => !r.ok).length;

  console.log(`\nSuccess count: ${successes} (Expected: 3)`);
  console.log(`Refused count: ${refused} (Expected: 1)`);

  if (successes !== 3 || refused !== 1) {
    throw new Error(`Concurrency test failed! Expected 3 successes and 1 refused, got ${successes} and ${refused}`);
  }

  // Verify that an already-scored evaluator can edit their mark
  const winningEvaluator = evaluators[results.findIndex((r) => r.ok)];
  console.log(`\nTesting edit by successful evaluator ${winningEvaluator.username}...`);
  const editRes = await submitMarkAtomic({
    teamId: testTeamId,
    evaluatorId: winningEvaluator.id,
    roundNumber: 1,
    value: 9.0,
  });
  console.log(`Edit result: ${editRes.ok ? '✓ Succeeded (edited)' : '✗ Failed'}`);
  if (!editRes.ok || editRes.action !== 'edited') {
    throw new Error('Evaluator edit failed!');
  }

  // Verify that a 4th evaluator trying again later is still refused with the exact required message
  const losingEvaluator = evaluators[results.findIndex((r) => !r.ok)];
  console.log(`\nTesting late 4th submission by ${losingEvaluator.username}...`);
  const lateRes = await submitMarkAtomic({
    teamId: testTeamId,
    evaluatorId: losingEvaluator.id,
    roundNumber: 1,
    value: 8.0,
  });
  console.log(`Late 4th result: ${lateRes.ok ? '✗ Error: should have failed' : '✓ Correctly Refused: ' + lateRes.error}`);
  if (lateRes.ok || !lateRes.error.includes('already has 3 evaluators in this round')) {
    throw new Error('Late 4th evaluator was not properly refused!');
  }

  // Clean up test data and reset round to not_started
  console.log('\nCleaning up test marks and resetting round status...');
  await pool.query('DELETE FROM marks WHERE team_id = $1', [testTeamId]);
  await pool.query('DELETE FROM mark_history WHERE team_id = $1', [testTeamId]);
  await pool.query("UPDATE rounds SET status = 'not_started', max_marks = NULL WHERE round_number = 1");

  console.log('\n🎉 ALL CONCURRENCY AND ATOMIC LOCK TESTS PASSED 100%!');
  await pool.end();
}

runTest().catch(async (err) => {
  console.error('Test error:', err);
  await pool.end();
  process.exit(1);
});
