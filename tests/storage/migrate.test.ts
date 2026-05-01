import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  backupDatabaseBeforeMigration,
  migrateDatabase,
  resolveDefaultMigrationsFolder,
  shouldBackupBeforeMigration,
} from '../../src/storage/migrate';

describe('migrateDatabase', () => {
  it('records drizzle migrations and can run repeatedly without changing existing data', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-migrate-'));

    try {
      const db = new Database(path.join(tempDir, 'data.db'));
      db.exec(`
        CREATE TABLE sample_records (
          id TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        INSERT INTO sample_records (id, value)
        VALUES ('sample-1', 'kept');
      `);

      migrateDatabase(db);
      migrateDatabase(db);

      const migrationCount = db
        .prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations')
        .get() as { count: number };
      const sample = db
        .prepare('SELECT value FROM sample_records WHERE id = ?')
        .get('sample-1') as { value: string } | undefined;

      db.close();

      expect(migrationCount.count).toBeGreaterThan(0);
      expect(sample?.value).toBe('kept');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('detects pending drizzle migrations before the baseline has been recorded', () => {
    const db = new Database(':memory:');

    try {
      expect(shouldBackupBeforeMigration(db)).toBe(true);

      migrateDatabase(db);

      expect(shouldBackupBeforeMigration(db)).toBe(false);
    } finally {
      db.close();
    }
  });

  it('finds bundled migrations even when the process starts outside the project root', () => {
    const originalCwd = process.cwd();
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-cwd-'));

    try {
      process.chdir(tempDir);

      expect(resolveDefaultMigrationsFolder()).toMatch(/drizzle$/);
    } finally {
      process.chdir(originalCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates one SQLite backup before the first pending migration on file databases', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-backup-'));
    const dbPath = path.join(tempDir, 'data.db');
    const backupDir = path.join(tempDir, 'backups');

    try {
      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE sample_records (
          id TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        INSERT INTO sample_records (id, value)
        VALUES ('sample-1', 'kept');
      `);

      backupDatabaseBeforeMigration(db, {
        databaseFile: dbPath,
        backupDir,
      });
      migrateDatabase(db);
      backupDatabaseBeforeMigration(db, {
        databaseFile: dbPath,
        backupDir,
      });

      db.close();

      const backups = readdirSync(backupDir).filter((fileName) =>
        fileName.endsWith('.db')
      );
      expect(backups).toHaveLength(1);

      const backupDb = new Database(path.join(backupDir, backups[0]));
      const sample = backupDb
        .prepare('SELECT value FROM sample_records WHERE id = ?')
        .get('sample-1') as { value: string } | undefined;
      backupDb.close();

      expect(sample?.value).toBe('kept');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
