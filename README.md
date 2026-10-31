# HACK-O-LANTERN 2026 — Evaluation App

Mobile-first evaluation platform for judges and organizers at **HACK-O-LANTERN 2026** (31 Oct – 1 Nov 2026, Mirai Floor, Bengaluru).

## Key Features & Rules
- **No Fixed Panels:** Any of the 6 evaluators can evaluate any of the 33 teams.
- **Atomic 3-Evaluator Limit:** Enforced with PostgreSQL row-level locks (`SELECT ... FOR UPDATE`). When 4 evaluators submit simultaneously, exactly 3 succeed and the 4th is refused with: `"This team already has 3 evaluators in this round"`.
- **QR Scanner + Manual Search:** Scans the exact printed Team Name (or Team ID). Handles low lighting with torch toggle and 2-second scan debounce.
- **Offline / Network Resilience:** Never loses marks; local storage persistence with retry button.
- **Admin Dashboard (Username: `sapnil`):** Progress tracking, marks matrix, slot freeing with required reason, scores calculation, tie handling, top 10 advancement, and CSV exports.

## Shared Database Schema
All three apps (`hackolantern-evaluation`, `hackolantern-leaderboard`, `hackolantern-snacks`) share the same PostgreSQL database:
1. `teams` (`id`, `name`, `normalised_name`, `status`)
2. `evaluators` (`username`, `display_name`, `role`, `password_hash`, `failed_attempts`, `locked_until`)
3. `rounds` (`round_number`, `label`, `max_marks`, `evaluators_per_team`, `status`)
4. `marks` (`team_id`, `evaluator_id`, `round_number`, `value`, `removed`)
5. `mark_history` (`mark_id`, `team_id`, `evaluator_id`, `round_number`, `old_value`, `new_value`, `action`, `changed_by`, `reason`)
6. `settings` (`leaderboard_mode`, `leaderboard_scope`, `final_ranking_rule`, `round_weights`, `final_weight`, `tie_break_order`, `number_of_finalists`, `frozen_snapshot`)
7. `snack_slots` (`id`, `name`, `active`)
8. `snack_given` (`team_id`, `slot_id`, `given_at`, `given_by`, `undone_at`, `undone_by`, `undo_reason`)

## Environment Variables
- `DATABASE_URL`: Connection string for PostgreSQL transaction pooler (port 6543)
- `DIRECT_URL`: Direct PostgreSQL connection string for migrations & locks (port 5432)
- `SESSION_SECRET`: 32+ character random string for signing secure evaluator session cookies
- `EVALUATOR_DEFAULT_PASSWORD`: Optional fallback password for evaluators
- `EVALUATOR_PASSWORD_<USERNAME>`: Optional per-evaluator password overrides (e.g. `EVALUATOR_PASSWORD_SAPNIL`, `EVALUATOR_PASSWORD_JHALAK`)

## Local Development
```bash
# 1. Install dependencies
npm install

# 2. Run migrations
npm run db:migrate

# 3. Seed 33 teams and 6 evaluators
npm run db:seed

# 4. Run concurrency test
npm run test:concurrency

# 5. Start development server
npm run dev
```

## Vercel Deployment
1. Connect this repository to Vercel.
2. Add `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, and evaluator password environment variables.
3. Deploy!

## Event Night Checklist
1. Verify all 33 teams are listed in `teams` table (`npm run db:seed`).
2. Log in as admin (`sapnil`) and set Round 1 `max_marks` (e.g. 10) before opening the round.
3. Open Round 1 when hacking / presentations start.
4. Keep track of evaluator coverage on the Admin Progress page ("Teams scored X of 33").
5. After Round 3 is complete, lock Round 3 and execute the "Advance top 10" flow.
6. Set Final round max marks and ranking rule before opening Round 4.

