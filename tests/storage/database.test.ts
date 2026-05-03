import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSqliteConnection } from '../../src/db/client';
import { runDrizzleMigrations } from '../../src/db/migrate';
import { createDatabase } from '../../src/storage/database';

describe('createDatabase', () => {
  it('creates the expected tables on first boot', () => {
    const db = createDatabase(':memory:');
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = rows.map((row) => row.name);

    expect(tableNames).toContain('books');
    expect(tableNames).toContain('writing_progress');
    expect(tableNames).not.toContain('execution_logs');
    expect(tableNames).toContain('model_configs');
  });

  it('tracks applied schema through drizzle migration metadata', () => {
    const db = createDatabase(':memory:');
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
      .get() as { name: string } | undefined;

    expect(row?.name).toBe('__drizzle_migrations');
  });

  it('upgrades an existing 0000 database with follow-up writing progress columns', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-weaver-migrate-'));
    const dbPath = path.join(tempDir, 'upgrade.sqlite');
    const sqlite = createSqliteConnection(dbPath);

    sqlite.exec(`
      CREATE TABLE books (
        id text PRIMARY KEY NOT NULL,
        title text NOT NULL,
        idea text NOT NULL,
        status text NOT NULL DEFAULT 'creating',
        target_chapters integer NOT NULL DEFAULT 100,
        words_per_chapter integer NOT NULL DEFAULT 2000,
        viral_strategy_json text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
      CREATE TABLE writing_progress (
        book_id text PRIMARY KEY NOT NULL,
        current_volume integer,
        current_chapter integer,
        phase text,
        step_label text,
        retry_count integer DEFAULT 0 NOT NULL,
        error_msg text,
        FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE no action ON DELETE no action
      );
      CREATE TABLE __drizzle_migrations (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        hash text NOT NULL,
        created_at numeric
      );
    `);
    sqlite
      .prepare(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
      )
      .run(
        '892c01f94024b80de448e5f2854c2b0e494889f0d3764e96e83b9ff67bcce57c',
        1777745068107
      );
    sqlite.close();

    const migrated = runDrizzleMigrations(dbPath);
    const columns = migrated
      .prepare("PRAGMA table_info('writing_progress')")
      .all() as Array<{ name: string }>;
    const columnNames = columns.map((column) => column.name);

    expect(columnNames).toContain('current_stage');
    expect(columnNames).toContain('current_arc');
    expect(columnNames).toContain('active_task_type');

    migrated.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
