import { eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { titleIdeaContracts } from '../db/schema/index.js';

export function createTitleIdeaContractRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: {
      bookId: string;
      title: string;
      idea: string;
      corePromise: string;
      titleHooks: string[];
      forbiddenDrift: string[];
    }) {
      const now = new Date().toISOString();

      drizzleDb
        .insert(titleIdeaContracts)
        .values({
          bookId: input.bookId,
          title: input.title,
          idea: input.idea,
          corePromise: input.corePromise,
          titleHooksJson: JSON.stringify(input.titleHooks),
          forbiddenDriftJson: JSON.stringify(input.forbiddenDrift),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: titleIdeaContracts.bookId,
          set: {
            title: input.title,
            idea: input.idea,
            corePromise: input.corePromise,
            titleHooksJson: JSON.stringify(input.titleHooks),
            forbiddenDriftJson: JSON.stringify(input.forbiddenDrift),
            updatedAt: now,
          },
        })
        .run();
    },

    getByBook(bookId: string) {
      const row = drizzleDb
        .select({
          bookId: titleIdeaContracts.bookId,
          title: titleIdeaContracts.title,
          idea: titleIdeaContracts.idea,
          corePromise: titleIdeaContracts.corePromise,
          titleHooksJson: titleIdeaContracts.titleHooksJson,
          forbiddenDriftJson: titleIdeaContracts.forbiddenDriftJson,
          createdAt: titleIdeaContracts.createdAt,
          updatedAt: titleIdeaContracts.updatedAt,
        })
        .from(titleIdeaContracts)
        .where(eq(titleIdeaContracts.bookId, bookId))
        .get() as
        | {
            bookId: string;
            title: string;
            idea: string;
            corePromise: string;
            titleHooksJson: string;
            forbiddenDriftJson: string;
            createdAt: string;
            updatedAt: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        bookId: row.bookId,
        title: row.title,
        idea: row.idea,
        corePromise: row.corePromise,
        titleHooks: JSON.parse(row.titleHooksJson) as string[],
        forbiddenDrift: JSON.parse(row.forbiddenDriftJson) as string[],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
  };
}
