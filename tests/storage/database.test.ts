import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    expect(tableNames).toContain('__drizzle_migrations');
  });

  it('does not drop existing chapter content when opening a legacy story schema', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-db-'));
    const dbPath = path.join(tempDir, 'data.db');

    try {
      const legacyDb = new Database(dbPath);
      legacyDb.exec(`
        CREATE TABLE books (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          idea TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'creating',
          model_id TEXT NOT NULL,
          target_chapters INTEGER NOT NULL,
          words_per_chapter INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE chapters (
          book_id TEXT NOT NULL,
          volume_index INTEGER NOT NULL,
          chapter_index INTEGER NOT NULL,
          title TEXT NOT NULL,
          outline TEXT,
          content TEXT,
          summary TEXT,
          word_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT,
          updated_at TEXT,
          PRIMARY KEY (book_id, volume_index, chapter_index)
        );

        INSERT INTO books (
          id, title, idea, status, model_id, target_chapters,
          words_per_chapter, created_at, updated_at
        ) VALUES (
          'book-legacy', 'Legacy Book', 'A city remembers.',
          'writing', 'mock:fallback', 1, 1200,
          '2026-04-30T00:00:00.000Z', '2026-04-30T00:00:00.000Z'
        );

        INSERT INTO chapters (
          book_id, volume_index, chapter_index, title, outline, content,
          summary, word_count, created_at, updated_at
        ) VALUES (
          'book-legacy', 1, 1, 'Opening', 'Old outline',
          'Existing generated prose', 'Existing summary', 1800,
          '2026-04-30T00:00:00.000Z', '2026-04-30T00:00:00.000Z'
        );
      `);
      legacyDb.close();

      const migratedDb = createDatabase(dbPath);
      const chapter = migratedDb
        .prepare(
          `SELECT content, summary, audit_score AS auditScore, draft_attempts AS draftAttempts
           FROM chapters
           WHERE book_id = ? AND chapter_index = ?`
        )
        .get('book-legacy', 1) as
        | {
            content: string;
            summary: string;
            auditScore: number | null;
            draftAttempts: number;
          }
        | undefined;

      migratedDb.close();

      expect(chapter).toEqual({
        content: 'Existing generated prose',
        summary: 'Existing summary',
        auditScore: null,
        draftAttempts: 0,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
