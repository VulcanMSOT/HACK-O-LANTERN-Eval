import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { pool } from '@/lib/db';

export async function DELETE(request, { params }) {
  let client;
  try {
    const admin = await requireAdmin();
    const markId = Number(params.id);
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || '').trim();

    if (!reason) {
      return NextResponse.json({ error: 'A reason is required to free a slot.' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const markRes = await client.query(
      'SELECT id, team_id, evaluator_id, round_number, value FROM marks WHERE id = $1 FOR UPDATE',
      [markId]
    );

    if (markRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Mark not found.' }, { status: 404 });
    }

    const mark = markRes.rows[0];

    // Record in history before deletion
    await client.query(
      `INSERT INTO mark_history (mark_id, team_id, evaluator_id, round_number, old_value, new_value, action, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5, NULL, 'admin_free_slot', $6, $7)`,
      [mark.id, mark.team_id, mark.evaluator_id, mark.round_number, mark.value, admin.username, reason]
    );

    // Remove the mark from marks table to free the slot
    await client.query('DELETE FROM marks WHERE id = $1', [mark.id]);

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, message: 'Slot freed successfully.' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Free slot error:', err);
    return NextResponse.json({ error: err.message || 'Could not free slot.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function PUT(request, { params }) {
  let client;
  try {
    const admin = await requireAdmin();
    const markId = Number(params.id);
    const body = await request.json();
    const numValue = Number(body.value);
    const reason = String(body.reason || '').trim();

    if (isNaN(numValue) || numValue < 0) {
      return NextResponse.json({ error: 'Valid non-negative mark is required.' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: 'A reason is required to modify a mark.' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const markRes = await client.query(
      'SELECT id, team_id, evaluator_id, round_number, value FROM marks WHERE id = $1 FOR UPDATE',
      [markId]
    );

    if (markRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Mark not found.' }, { status: 404 });
    }

    const mark = markRes.rows[0];

    // Check round max marks
    const roundRes = await client.query(
      'SELECT max_marks FROM rounds WHERE round_number = $1',
      [mark.round_number]
    );
    const maxMarks = Number(roundRes.rows[0]?.max_marks || 100);
    if (numValue > maxMarks) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: `Mark cannot exceed round maximum of ${maxMarks}.` }, { status: 400 });
    }

    await client.query('UPDATE marks SET value = $1, updated_at = NOW() WHERE id = $2', [numValue, mark.id]);

    await client.query(
      `INSERT INTO mark_history (mark_id, team_id, evaluator_id, round_number, old_value, new_value, action, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6, 'admin_override', $7, $8)`,
      [mark.id, mark.team_id, mark.evaluator_id, mark.round_number, mark.value, numValue, admin.username, reason]
    );

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, message: 'Mark updated successfully.' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Update mark error:', err);
    return NextResponse.json({ error: err.message || 'Could not update mark.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

