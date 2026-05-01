import type { Database as SqliteDatabase } from 'better-sqlite3';

export function createSettingsRepository(db: SqliteDatabase) {
  return {
    list() {
      return Object.fromEntries(
        (
          db.prepare('SELECT key, value FROM settings ORDER BY key').all() as Array<{
            key: string;
            value: string;
          }>
        ).map((row) => [row.key, row.value])
      );
    },

    get(key: string) {
      const row = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get(key) as { value: string } | undefined;

      return row?.value ?? null;
    },

    set(key: string, value: string) {
      db.prepare(
        `
          INSERT INTO settings (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `
      ).run(key, value);
    },
  };
}
