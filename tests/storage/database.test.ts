import { describe, expect, it } from 'vitest';
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
});
