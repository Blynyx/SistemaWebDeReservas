import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { backendRoot, DB_PATH } from '../config/env.js';

const dbFilePath = path.resolve(backendRoot, DB_PATH);

fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

const db = new Database(dbFilePath);

// En SQLite las claves foráneas están desactivadas por defecto.
// Hay que activarlas en cada conexión para que se respeten.
db.pragma('foreign_keys = ON');

export function getDb() {
  return db;
}
