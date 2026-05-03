import { desc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { storyLedgers } from '../db/schema/index.js';

export type StoryRhythmPosition =
  | 'setup'
  | 'escalation'
  | 'payoff'
  | 'twist'
  | 'cost';

export type StoryLedger = {
  bookId: string;
  chapterIndex: number;
  mainlineProgress: string;
  activeSubplots: unknown;
  openPromises: unknown;
  characterTruths: unknown;
  relationshipDeltas: unknown;
  worldFacts: unknown;
  rhythmPosition: StoryRhythmPosition;
  riskFlags: unknown;
};

export function createStoryLedgerRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: StoryLedger) {
      const createdAt = new Date().toISOString();

      drizzleDb
        .insert(storyLedgers)
        .values({
          bookId: input.bookId,
          chapterIndex: input.chapterIndex,
          mainlineProgress: input.mainlineProgress,
          activeSubplotsJson: JSON.stringify(input.activeSubplots),
          openPromisesJson: JSON.stringify(input.openPromises),
          characterTruthsJson: JSON.stringify(input.characterTruths),
          relationshipDeltasJson: JSON.stringify(input.relationshipDeltas),
          worldFactsJson: JSON.stringify(input.worldFacts),
          rhythmPosition: input.rhythmPosition,
          riskFlagsJson: JSON.stringify(input.riskFlags),
          createdAt,
        })
        .onConflictDoUpdate({
          target: [storyLedgers.bookId, storyLedgers.chapterIndex],
          set: {
            mainlineProgress: input.mainlineProgress,
            activeSubplotsJson: JSON.stringify(input.activeSubplots),
            openPromisesJson: JSON.stringify(input.openPromises),
            characterTruthsJson: JSON.stringify(input.characterTruths),
            relationshipDeltasJson: JSON.stringify(input.relationshipDeltas),
            worldFactsJson: JSON.stringify(input.worldFacts),
            rhythmPosition: input.rhythmPosition,
            riskFlagsJson: JSON.stringify(input.riskFlags),
            createdAt,
          },
        })
        .run();
    },

    getLatestByBook(bookId: string) {
      const row = drizzleDb
        .select({
          bookId: storyLedgers.bookId,
          chapterIndex: storyLedgers.chapterIndex,
          mainlineProgress: storyLedgers.mainlineProgress,
          activeSubplotsJson: storyLedgers.activeSubplotsJson,
          openPromisesJson: storyLedgers.openPromisesJson,
          characterTruthsJson: storyLedgers.characterTruthsJson,
          relationshipDeltasJson: storyLedgers.relationshipDeltasJson,
          worldFactsJson: storyLedgers.worldFactsJson,
          rhythmPosition: storyLedgers.rhythmPosition,
          riskFlagsJson: storyLedgers.riskFlagsJson,
          createdAt: storyLedgers.createdAt,
        })
        .from(storyLedgers)
        .where(eq(storyLedgers.bookId, bookId))
        .orderBy(desc(storyLedgers.chapterIndex))
        .limit(1)
        .get() as
        | {
            bookId: string;
            chapterIndex: number;
            mainlineProgress: string;
            activeSubplotsJson: string;
            openPromisesJson: string;
            characterTruthsJson: string;
            relationshipDeltasJson: string;
            worldFactsJson: string;
            rhythmPosition: StoryRhythmPosition;
            riskFlagsJson: string;
            createdAt: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        bookId: row.bookId,
        chapterIndex: row.chapterIndex,
        mainlineProgress: row.mainlineProgress,
        activeSubplots: JSON.parse(row.activeSubplotsJson) as unknown,
        openPromises: JSON.parse(row.openPromisesJson) as unknown,
        characterTruths: JSON.parse(row.characterTruthsJson) as unknown,
        relationshipDeltas: JSON.parse(row.relationshipDeltasJson) as unknown,
        worldFacts: JSON.parse(row.worldFactsJson) as unknown,
        rhythmPosition: row.rhythmPosition as StoryRhythmPosition,
        riskFlags: JSON.parse(row.riskFlagsJson) as unknown,
        createdAt: row.createdAt,
      };
    },
  };
}
