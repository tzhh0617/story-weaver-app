import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { settings } from '../db/schema/index.js';

export function createSettingsRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    list() {
      return Object.fromEntries(
        drizzleDb
          .select()
          .from(settings)
          .orderBy(asc(settings.key))
          .all()
          .map((row) => [row.key, row.value])
      );
    },

    get(key: string) {
      const row = drizzleDb
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, key))
        .get();

      return row?.value ?? null;
    },

    set(key: string, value: string) {
      drizzleDb
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value },
        })
        .run();
    },
  };
}
