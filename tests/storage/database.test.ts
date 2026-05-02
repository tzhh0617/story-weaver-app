import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';

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

    db.close();
  });

  it('preserves existing data when re-opened', () => {
    const db = createDatabase(':memory:');

    db.exec(`
      INSERT INTO books (
        id, title, idea, status, model_id, target_chapters,
        words_per_chapter, created_at, updated_at
      ) VALUES (
        'book-1', 'Test Book', 'An idea.', 'creating', 'test:model', 1, 1200,
        '2026-05-02T00:00:00.000Z', '2026-05-02T00:00:00.000Z'
      );
    `);

    const row = db
      .prepare('SELECT title FROM books WHERE id = ?')
      .get('book-1') as { title: string } | undefined;

    db.close();

    expect(row?.title).toBe('Test Book');
  });
});
