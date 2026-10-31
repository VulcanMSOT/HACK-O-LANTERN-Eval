import { randomBytes } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Error: DATABASE_URL or DIRECT_URL is required in environment.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

export const TEAM_ROSTER_RAW = `
VHK-1011 ZomByte; VHK-1012 Catalyst; VHK-1017 PromptOPS; VHK-1019 Pleasure n Punishment;
VHK-1020 2witch1glitch; VHK-1021 Winifred Sanderson; VHK-1022 Gandiva; VHK-1033 COVEN;
VHK-1034 Syntax Terror; VHK-1035 VERGE; VHK-1036 EsParda; VHK-1037 MATRIX;
VHK-1038 Code Nomads; VHK-1039 Team Rocket; VHK-1040 Hauntix; VHK-1053 Ghost Protocol;
VHK-1054 Nightmare.exe; VHK-1055 Ghost code; VHK-1056 Glitz; VHK-1059 Glitch;
VHK-1060 Code busters; VHK-1062 404: Souls Not Found; VHK-1063 ByteCode;
VHK-1066 Team Vedam; VHK-1071 Hellbent; VHK-1072 Nightmares; VHK-1073 Ratios;
VHK-1074 CodeTitans; VHK-1075 BAAPUJI; VHK-1076 Khatarnaak coders;
VHK-1077 Never Mind; VHK-1081 Interstellar; VHK-1082 Monarch
`;

export function parseRoster(raw) {
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split(/\s+/);
      const id = parts[0];
      const name = parts.slice(1).join(' ').trim();
      const normalised = name.toLowerCase().replace(/\s+/g, ' ');
      return { id, name, normalised };
    });
}

export const EVALUATORS_DEF = [
  { username: 'jhalak', displayName: 'Jhalak', role: 'evaluator' },
  { username: 'sapnil', displayName: 'Sapnil', role: 'admin' },
  { username: 'harsh', displayName: 'Harsh', role: 'evaluator' },
  { username: 'dhruvesh', displayName: 'Dhruvesh', role: 'evaluator' },
  { username: 'anushka', displayName: 'Anushka', role: 'evaluator' },
  { username: 'padmasri', displayName: 'Padmasri', role: 'evaluator' },
];

async function seed() {
  console.log('=== SEEDING HACK-O-LANTERN EVENT DATA ===\n');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Seed Teams
    const teams = parseRoster(TEAM_ROSTER_RAW);
    console.log(`1. Seeding ${teams.length} teams...`);
    for (const t of teams) {
      await client.query(
        `INSERT INTO teams (id, name, normalised_name, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           normalised_name = EXCLUDED.normalised_name`,
        [t.id, t.name, t.normalised]
      );
    }
    const teamCountRes = await client.query('SELECT count(*) FROM teams');
    console.log(`✓ Teams in database: ${teamCountRes.rows[0].count}`);

    // 2. Seed Evaluators
    console.log('\n2. Seeding 6 Evaluator accounts from environment variables...');
    const defaultPassword = process.env.EVALUATOR_DEFAULT_PASSWORD;

    for (const ev of EVALUATORS_DEF) {
      const envKey = `EVALUATOR_PASSWORD_${ev.username.toUpperCase()}`;
      const password = process.env[envKey] || defaultPassword || randomBytes(12).toString('hex');
      const passwordHash = await bcrypt.hash(password, 10);

      await client.query(
        `INSERT INTO evaluators (username, display_name, role, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           role = EXCLUDED.role,
           password_hash = EXCLUDED.password_hash`,
        [ev.username, ev.displayName, ev.role, passwordHash]
      );
    }

    const evCountRes = await client.query('SELECT username, display_name, role, created_at FROM evaluators ORDER BY id ASC');
    console.log('✓ Evaluators in database:');
    evCountRes.rows.forEach((r) => {
      console.log(`  • ${r.username} (${r.display_name}) - Role: ${r.role}`);
    });

    // 3. Seed Rounds
    console.log('\n3. Seeding Rounds 1 to 4...');
    const rounds = [
      { num: 1, label: 'Round 1', evPerTeam: 3 },
      { num: 2, label: 'Round 2', evPerTeam: 3 },
      { num: 3, label: 'Round 3', evPerTeam: 3 },
      { num: 4, label: 'Final', evPerTeam: 3 },
    ];
    for (const r of rounds) {
      await client.query(
        `INSERT INTO rounds (round_number, label, evaluators_per_team, status)
         VALUES ($1, $2, $3, 'not_started')
         ON CONFLICT (round_number) DO UPDATE SET
           label = EXCLUDED.label,
           evaluators_per_team = EXCLUDED.evaluators_per_team`,
        [r.num, r.label, r.evPerTeam]
      );
    }
    console.log('✓ Rounds 1 to 4 initialized.');

    // 4. Seed Settings
    console.log('\n4. Initializing Event Settings...');
    await client.query(
      `INSERT INTO settings (id, leaderboard_mode, leaderboard_scope, round_weights, final_weight, tie_break_order, number_of_finalists)
       VALUES (1, 'live', 'finalists_only', '{"1":1, "2":1, "3":1}', 1.0, '[3, 2, 1]', 10)
       ON CONFLICT (id) DO NOTHING`
    );
    console.log('✓ Default settings initialized.');

    // 5. Seed Default Snack Slot
    console.log('\n5. Initializing Snack Slots...');
    await client.query(
      `INSERT INTO snack_slots (id, name, active)
       VALUES (1, 'Snacks', true)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = true`
    );
    console.log('✓ Default snack slot ("Snacks") active.');

    await client.query('COMMIT');
    console.log('\n🎉 ALL SEED DATA SUCCESSFULLY APPLIED!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
