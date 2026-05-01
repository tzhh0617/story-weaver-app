import type { Database as SqliteDatabase } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

const migrationTable = '__drizzle_migrations';
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveDefaultMigrationsFolder() {
  const candidates = [
    path.resolve(process.cwd(), 'drizzle'),
    path.resolve(moduleDir, '../../drizzle'),
    path.resolve(moduleDir, '../../../drizzle'),
  ];
  const migrationsFolder = candidates.find((candidate) =>
    existsSync(path.join(candidate, 'meta', '_journal.json'))
  );

  return migrationsFolder ?? candidates[0];
}

function latestMigrationTimestamp(migrationsFolder: string) {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries?: Array<{ when: number }>;
  };
  const timestamps = (journal.entries ?? []).map((entry) => entry.when);

  return timestamps.length ? Math.max(...timestamps) : 0;
}

function migrationTableExists(db: SqliteDatabase) {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    .get(migrationTable);

  return Boolean(row);
}

function latestAppliedMigrationTimestamp(db: SqliteDatabase) {
  if (!migrationTableExists(db)) {
    return null;
  }

  const row = db
    .prepare(`SELECT MAX(created_at) AS createdAt FROM ${migrationTable}`)
    .get() as { createdAt: number | null } | undefined;

  return row?.createdAt ?? null;
}

export function shouldBackupBeforeMigration(
  db: SqliteDatabase,
  options?: { migrationsFolder?: string }
) {
  const migrationsFolder = options?.migrationsFolder ?? resolveDefaultMigrationsFolder();
  const latestMigration = latestMigrationTimestamp(migrationsFolder);
  const latestAppliedMigration = latestAppliedMigrationTimestamp(db);

  return latestAppliedMigration === null || latestAppliedMigration < latestMigration;
}

function quoteSqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function safeBackupPath(backupFile: string, rootDir: string): string {
  const resolved = path.resolve(backupFile);
  if (!resolved.startsWith(path.resolve(rootDir))) {
    throw new Error('Backup path must be within the data directory');
  }
  return resolved;
}

export function backupDatabaseBeforeMigration(
  db: SqliteDatabase,
  input: {
    databaseFile: string;
    backupDir: string;
    migrationsFolder?: string;
  }
) {
  if (
    input.databaseFile === ':memory:' ||
    !existsSync(input.databaseFile) ||
    !shouldBackupBeforeMigration(db, {
      migrationsFolder: input.migrationsFolder,
    })
  ) {
    return null;
  }

  mkdirSync(input.backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = safeBackupPath(
    path.join(input.backupDir, `data-before-migrate-${timestamp}.db`),
    input.backupDir
  );

  db.exec(`VACUUM INTO ${quoteSqlString(backupFile)}`);

  return backupFile;
}

export function migrateDatabase(
  db: SqliteDatabase,
  options?: { migrationsFolder?: string }
) {
  migrate(drizzle(db, { schema }), {
    migrationsFolder: options?.migrationsFolder ?? resolveDefaultMigrationsFolder(),
  });
}
