import { NextResponse } from 'next/server';
import { rows, withDatabase } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const movements = await withDatabase((db) => rows(db, `
    SELECT m.id, m.product_id, m.type, m.quantity, m.note, m.created_at, p.name, p.sku
    FROM movements m
    JOIN products p ON p.id = m.product_id
    ORDER BY m.id DESC
    LIMIT 100
  `));
  return NextResponse.json(movements);
}
