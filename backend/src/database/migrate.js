import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

const db = getDb();

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((filename) => filename.endsWith('.sql'))
  .sort();

const applied = new Set(
  db.prepare('SELECT filename FROM schema_migrations').all().map((row) => row.filename)
);

const pending = migrationFiles.filter((filename) => !applied.has(filename));

if (pending.length === 0) {
  console.log('No hay migraciones pendientes.');
  process.exit(0);
}

for (const filename of pending) {
  const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');

  // La inserción en schema_migrations va en la misma transacción:
  // si el SQL falla, no queda registrada como aplicada.
  const applyMigration = db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(filename);
  });

  try {
    applyMigration();
    console.log(`Aplicada: ${filename}`);
  } catch (error) {
    console.error(`Error al aplicar ${filename}:`);
    console.error(error.message);
    process.exit(1);
  }
}

console.log('Migraciones aplicadas correctamente.');
