import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    
    // If 'open' is explicitly passed in body, set it; otherwise toggle
    let newStatus;
    if (typeof body.open === 'boolean') {
      newStatus = body.open;
    } else {
      const current = await query('SELECT problem_statement_selection_open FROM settings WHERE id = 1');
      const isCurrentlyOpen = current.rows[0]?.problem_statement_selection_open ?? false;
      newStatus = !isCurrentlyOpen;
    }

    await query(
      'UPDATE settings SET problem_statement_selection_open = $1, updated_at = NOW() WHERE id = 1',
      [newStatus]
    );

    return NextResponse.json({
      success: true,
      isOpen: newStatus,
      message: newStatus
        ? 'Problem statement selection is now OPEN. Students can submit.'
        : 'Problem statement selection is now CLOSED. Submissions are locked.',
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
