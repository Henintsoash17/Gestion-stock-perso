import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');
const databasePath = path.join(dataDir, 'stockflow.db');

let sqlPromise: Promise<SqlJsStatic> | undefined;
let databasePromise: Promise<Database> | undefined;

function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    });
  }
  return sqlPromise;
}

function rows<T>(db: Database, sql: string, params: unknown[] = []): T[] {
  const statement = db.prepare(sql);
  try {
    statement.bind(params as (string | number | null | Uint8Array)[]);
    const result: T[] = [];
    while (statement.step()) result.push(statement.getAsObject() as T);
    return result;
  } finally {
    statement.free();
  }
}

function initializeSchema(db: Database): void {
  db.run('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
      quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      min_stock INTEGER NOT NULL DEFAULT 5 CHECK(min_stock >= 0),
      emoji TEXT NOT NULL DEFAULT '📦',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('IN','OUT','ADJUSTMENT')),
      quantity INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
    );
  `);

  const count = rows<{ count: number }>(db, 'SELECT COUNT(*) AS count FROM products')[0]?.count ?? 0;
  if (count === 0) {
    const samples: [string, string, string, number, number, number, string][] = [
      ['Clavier mécanique K2', 'ACC-001', 'Accessoires', 185000, 24, 8, '⌨️'],
      ['Souris sans fil Pro', 'ACC-002', 'Accessoires', 75000, 6, 10, '🖱️'],
      ['Écran 24 pouces IPS', 'INF-001', 'Informatique', 620000, 15, 5, '🖥️'],
      ['Ordinateur portable X14', 'INF-002', 'Informatique', 2850000, 8, 3, '💻'],
      ['Casque audio Studio', 'AUD-001', 'Audio', 245000, 3, 8, '🎧'],
      ['Câble USB-C 1 m', 'ACC-003', 'Accessoires', 18000, 42, 15, '🔌'],
      ['Webcam Full HD', 'INF-003', 'Informatique', 145000, 0, 5, '📷'],
      ['Enceinte Bluetooth', 'AUD-002', 'Audio', 195000, 12, 4, '🔊'],
      ['Support ordinateur', 'ACC-004', 'Accessoires', 95000, 4, 6, '🗜️'],
      ['Micro USB Podcast', 'AUD-003', 'Audio', 320000, 7, 4, '🎙️'],
      ['Clavier sans fil compact', 'ACC-005', 'Accessoires', 125000, 18, 6, '⌨️'],
      ['Hub USB-C 7-en-1', 'ACC-006', 'Accessoires', 210000, 2, 5, '🔌'],
      ['Chargeur rapide 65 W', 'ACC-007', 'Accessoires', 98000, 31, 10, '🔋'],
      ['Écran 27 pouces QHD', 'INF-004', 'Informatique', 1180000, 9, 4, '🖥️'],
      ['Mini PC Ryzen 5', 'INF-005', 'Informatique', 2450000, 5, 3, '🖥️'],
      ['SSD externe 1 To', 'INF-006', 'Informatique', 485000, 1, 6, '💾'],
      ['Tablette graphique', 'INF-007', 'Informatique', 690000, 7, 3, '✍️'],
      ['Casque sans fil ANC', 'AUD-004', 'Audio', 560000, 11, 5, '🎧'],
      ['Écouteurs Bluetooth', 'AUD-005', 'Audio', 165000, 0, 5, '🎵'],
      ['Lampe de bureau LED', 'BUR-001', 'Bureau', 87000, 14, 6, '💡'],
      ['Chaise ergonomique', 'BUR-002', 'Bureau', 1450000, 3, 4, '🪑'],
      ['Routeur Wi-Fi 6', 'RES-001', 'Réseau', 375000, 8, 4, '📡'],
      ['Switch réseau 8 ports', 'RES-002', 'Réseau', 225000, 6, 3, '🔀'],
      ['Onduleur 1200 VA', 'RES-003', 'Réseau', 780000, 2, 4, '🔌'],
    ];
    db.run('BEGIN TRANSACTION');
    try {
      for (const product of samples) {
        db.run(
          'INSERT INTO products (name,sku,category,price,quantity,min_stock,emoji) VALUES (?,?,?,?,?,?,?)',
          product,
        );
      }
      const movements: [string, 'IN' | 'OUT', number, string, number][] = [
        ['INF-004', 'IN', 4, 'Réception fournisseur', 1],
        ['ACC-002', 'OUT', 2, 'Commande client', 2],
        ['RES-001', 'IN', 5, 'Réassort hebdomadaire', 4],
        ['AUD-001', 'OUT', 1, 'Vente en boutique', 7],
        ['BUR-001', 'IN', 8, 'Réception fournisseur', 10],
        ['INF-003', 'OUT', 2, 'Commande client', 16],
        ['ACC-006', 'OUT', 3, 'Vente en boutique', 22],
        ['INF-002', 'IN', 2, 'Réassort hebdomadaire', 28],
      ];
      for (const [sku, type, quantity, note, hoursAgo] of movements) {
        db.run(`
          INSERT INTO movements (product_id, type, quantity, note, created_at)
          SELECT id, ?, ?, ?, datetime('now', ?)
          FROM products WHERE sku = ?
        `, [type, quantity, note, `-${hoursAgo} hours`, sku]);
      }
      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }
}

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = (async () => {
      fs.mkdirSync(dataDir, { recursive: true });
      const SQL = await getSql();
      const db = fs.existsSync(databasePath)
        ? new SQL.Database(new Uint8Array(fs.readFileSync(databasePath)))
        : new SQL.Database();
      initializeSchema(db);
      fs.writeFileSync(databasePath, Buffer.from(db.export()));
      return db;
    })();
  }
  return databasePromise;
}

/** Executes a database operation and persists the local SQLite file afterward. */
export async function withDatabase<T>(operation: (db: Database) => T): Promise<T> {
  const db = await getDatabase();
  const result = operation(db);
  fs.writeFileSync(databasePath, Buffer.from(db.export()));
  return result;
}

export { rows };
