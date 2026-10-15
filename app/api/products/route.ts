import { NextResponse } from 'next/server';
import { rows, withDatabase } from '@/lib/db';

export const runtime = 'nodejs';

export type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  quantity: number;
  min_stock: number;
  emoji: string;
  created_at: string;
  updated_at: string;
};

type ProductInput = {
  name?: unknown;
  sku?: unknown;
  category?: unknown;
  price?: unknown;
  quantity?: unknown;
  min_stock?: unknown;
  emoji?: unknown;
};

function getStatus(product: Pick<Product, 'quantity' | 'min_stock'>) {
  return product.quantity === 0 ? 'out' : product.quantity <= product.min_stock ? 'low' : 'ok';
}

function normalize(body: ProductInput) {
  return {
    name: String(body.name ?? '').trim(),
    sku: String(body.sku ?? '').trim().toUpperCase(),
    category: String(body.category ?? '').trim(),
    price: Number(body.price),
    quantity: Number(body.quantity),
    min_stock: Number(body.min_stock),
    emoji: String(body.emoji || '📦'),
  };
}

function validate(body: ProductInput): string | null {
  if (!body.name || !body.sku || !body.category) {
    return 'Nom, référence SKU et catégorie sont obligatoires.';
  }
  if (![body.price, body.quantity, body.min_stock].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) {
    return 'Prix, quantité et seuil doivent être des nombres positifs.';
  }
  if (!Number.isInteger(Number(body.quantity)) || !Number.isInteger(Number(body.min_stock))) {
    return 'La quantité et le seuil doivent être des nombres entiers.';
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = `%${searchParams.get('q')?.trim() ?? ''}%`;
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';

  const products = await withDatabase((db) => rows<Product>(db, `
    SELECT * FROM products
    WHERE (name LIKE ? OR sku LIKE ?) AND (? = '' OR category = ?)
    ORDER BY name COLLATE NOCASE
  `, [q, q, category, category]));

  return NextResponse.json(products.filter((product) => !status || getStatus(product) === status));
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ProductInput;
    const error = validate(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const product = normalize(body);

    const created = await withDatabase((db) => {
      db.run(
        'INSERT INTO products(name,sku,category,price,quantity,min_stock,emoji) VALUES(?,?,?,?,?,?,?)',
        [product.name, product.sku, product.category, product.price, product.quantity, product.min_stock, product.emoji],
      );
      const id = Number(rows<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')[0]?.id);
      return rows<Product>(db, 'SELECT * FROM products WHERE id = ?', [id])[0];
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return NextResponse.json({ error: 'Cette référence SKU existe déjà.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Impossible de créer le produit.' }, { status: 500 });
  }
}
