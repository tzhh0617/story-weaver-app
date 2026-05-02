import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDrizzleDb, createSqliteConnection } from './client.js';

export function runDrizzleMigrations(
  filenameOrConnection: string | Parameters<typeof createDrizzleDb>[0],
  migrationsFolder = path.resolve(process.cwd(), 'drizzle')
) {
  const sqlite =
    typeof filenameOrConnection === 'string'
      ? createSqliteConnection(filenameOrConnection)
      : filenameOrConnection;

  const db = createDrizzleDb(sqlite);
  migrate(db, { migrationsFolder });

  return sqlite;
}

const entryPath = fileURLToPath(import.meta.url);

if (process.argv[1] === entryPath) {
  const filename =
    process.argv[2] ?? path.resolve(process.cwd(), '.tmp/story-weaver-plan.sqlite');
  const sqlite = runDrizzleMigrations(filename);
  sqlite.close();
}
