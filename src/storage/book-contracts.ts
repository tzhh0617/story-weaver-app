import { eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { bookContracts } from '../db/schema/index.js';

export type BookContract = {
  bookId: string;
  titlePromise: string;
  corePremise: string;
  mainlinePromise: string;
  protagonistCoreDesire: string;
  protagonistNoDriftRules: string[];
  keyCharacterBoundaries: string[];
  mandatoryPayoffs: string[];
  antiDriftRules: string[];
  activeTemplate: string;
};

export function createBookContractRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: BookContract) {
      const now = new Date().toISOString();

      drizzleDb
        .insert(bookContracts)
        .values({
          bookId: input.bookId,
          titlePromise: input.titlePromise,
          corePremise: input.corePremise,
          mainlinePromise: input.mainlinePromise,
          protagonistCoreDesire: input.protagonistCoreDesire,
          protagonistNoDriftRulesJson: JSON.stringify(input.protagonistNoDriftRules),
          keyCharacterBoundariesJson: JSON.stringify(input.keyCharacterBoundaries),
          mandatoryPayoffsJson: JSON.stringify(input.mandatoryPayoffs),
          antiDriftRulesJson: JSON.stringify(input.antiDriftRules),
          activeTemplate: input.activeTemplate,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: bookContracts.bookId,
          set: {
            titlePromise: input.titlePromise,
            corePremise: input.corePremise,
            mainlinePromise: input.mainlinePromise,
            protagonistCoreDesire: input.protagonistCoreDesire,
            protagonistNoDriftRulesJson: JSON.stringify(input.protagonistNoDriftRules),
            keyCharacterBoundariesJson: JSON.stringify(input.keyCharacterBoundaries),
            mandatoryPayoffsJson: JSON.stringify(input.mandatoryPayoffs),
            antiDriftRulesJson: JSON.stringify(input.antiDriftRules),
            activeTemplate: input.activeTemplate,
            updatedAt: now,
          },
        })
        .run();
    },

    getByBook(bookId: string) {
      const row = drizzleDb
        .select({
          bookId: bookContracts.bookId,
          titlePromise: bookContracts.titlePromise,
          corePremise: bookContracts.corePremise,
          mainlinePromise: bookContracts.mainlinePromise,
          protagonistCoreDesire: bookContracts.protagonistCoreDesire,
          protagonistNoDriftRulesJson: bookContracts.protagonistNoDriftRulesJson,
          keyCharacterBoundariesJson: bookContracts.keyCharacterBoundariesJson,
          mandatoryPayoffsJson: bookContracts.mandatoryPayoffsJson,
          antiDriftRulesJson: bookContracts.antiDriftRulesJson,
          activeTemplate: bookContracts.activeTemplate,
          createdAt: bookContracts.createdAt,
          updatedAt: bookContracts.updatedAt,
        })
        .from(bookContracts)
        .where(eq(bookContracts.bookId, bookId))
        .get() as
        | {
            bookId: string;
            titlePromise: string;
            corePremise: string;
            mainlinePromise: string;
            protagonistCoreDesire: string;
            protagonistNoDriftRulesJson: string;
            keyCharacterBoundariesJson: string;
            mandatoryPayoffsJson: string;
            antiDriftRulesJson: string;
            activeTemplate: string;
            createdAt: string;
            updatedAt: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        bookId: row.bookId,
        titlePromise: row.titlePromise,
        corePremise: row.corePremise,
        mainlinePromise: row.mainlinePromise,
        protagonistCoreDesire: row.protagonistCoreDesire,
        protagonistNoDriftRules: JSON.parse(row.protagonistNoDriftRulesJson) as string[],
        keyCharacterBoundaries: JSON.parse(row.keyCharacterBoundariesJson) as string[],
        mandatoryPayoffs: JSON.parse(row.mandatoryPayoffsJson) as string[],
        antiDriftRules: JSON.parse(row.antiDriftRulesJson) as string[],
        activeTemplate: row.activeTemplate,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
  };
}
