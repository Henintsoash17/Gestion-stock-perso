import { NextResponse } from 'next/server';
import { rows, withDatabase } from '@/lib/db';
import type { Product } from '../route';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  if (body.action === 'move') {
    const quantity = Number(body.quantity);
    const type = body.type === 'IN' || body.type === 'OUT' ? body.type : null;
    if (!Number.isInteger(quantity) || quantity <= 0 || !type) {
      return NextResponse.json({ error: 'Mouvement invalide.' }, { status: 400 });
    }

    try {
      const updated = await withDatabase((db) => {
        const current = rows<Product>(db, 'SELECT * FROM products WHERE id = ?', [id])[0];
        if (!current) return { error: 'Produit introuvable.', status: 404 as const };
        if (type === 'OUT' && quantity > current.quantity) {
          return { error: 'Stock insuffisant pour cette sortie.', status: 409 as const };
        }

        db.run('BEGIN TRANSACTION');
        try {
          db.run("UPDATE products SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?", [type === 'IN' ? quantity : -quantity, id]);
          db.run('INSERT INTO movements(product_id,type,quantity,note) VALUES(?,?,?,?)', [id, type, quantity, body.note ? String(body.note) : null]);
          db.run('COMMIT');
        } catch (error) {
          db.run('ROLLBACK');
          throw error;
        }
        return { product: rows<Product>(db, 'SELECT * FROM products WHERE id = ?', [id])[0] };
      });
      if ('error' in updated) return NextResponse.json({ error: updated.error }, { status: updated.status });
      return NextResponse.json(updated.product);
    } catch {
      return NextResponse.json({ error: 'Impossible d’enregistrer le mouvement.' }, { status: 500 });
    }
  }

  const merged = {
    name: String(body.name ?? '').trim(),
    sku: String(body.sku ?? '').trim().toUpperCase(),
    category: String(body.category ?? '').trim(),
    price: Number(body.price),
    quantity: Number(body.quantity),
    min_stock: Number(body.min_stock),
    emoji: String(body.emoji || '📦'),
  };
  if (!merged.name || !merged.sku || !merged.category ||
    ![merged.price, merged.quantity, merged.min_stock].every((value) => Number.isFinite(value) && value >= 0) ||
    !Number.isInteger(merged.quantity) || !Number.isInteger(merged.min_stock)) {
    return NextResponse.json({ error: 'Vérifiez les champs du produit.' }, { status: 400 });
  }

  try {
    const updated = await withDatabase((db) => {
      if (!rows<{ id: number }>(db, 'SELECT id FROM products WHERE id = ?', [id])[0]) return null;
      db.run(`UPDATE products SET name=?, sku=?, category=?, price=?, quantity=?, min_stock=?, emoji=?, updated_at=datetime('now') WHERE id=?`,
        [merged.name, merged.sku, merged.category, merged.price, merged.quantity, merged.min_stock, merged.emoji, id]);
      return rows<Product>(db, 'SELECT * FROM products WHERE id = ?', [id])[0];
    });
    if (!updated) return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    if (String(error).includes('UNIQUE')) return NextResponse.json({ error: 'Cette référence SKU existe déjà.' }, { status: 409 });
    return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Context) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });

  const result = await withDatabase((db) => {
    if (!rows<{ id: number }>(db, 'SELECT id FROM products WHERE id = ?', [id])[0]) {
      return { error: 'Produit introuvable.', status: 404 as const };
    }
    if (rows<{ id: number }>(db, 'SELECT id FROM movements WHERE product_id = ? LIMIT 1', [id])[0]) {
      return { error: 'Ce produit a un historique de mouvements et ne peut pas être supprimé.', status: 409 as const };
    }
    db.run('DELETE FROM products WHERE id = ?', [id]);
    return { ok: true as const };
  });

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
