import Database from 'better-sqlite3';
import { migrations } from './migrations.js';

export function createDatabase(filename: string) {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  for (const migration of migrations) {
    db.exec(migration);
  }

  return db;
}
