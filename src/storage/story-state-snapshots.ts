import { desc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { storyStateSnapshots } from '../db/schema/index.js';

export function createStoryStateSnapshotRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: {
      bookId: string;
      chapterIndex: number;
      summary: string;
      titleIdeaAlignment: string;
      flatnessRisk: string;
      characterChanges: unknown;
      relationshipChanges: unknown;
      worldFacts: unknown;
      threadUpdates: unknown;
      unresolvedPromises: unknown;
      stageProgress: string;
      remainingChapterBudget: number;
    }) {
      const createdAt = new Date().toISOString();

      drizzleDb
        .insert(storyStateSnapshots)
        .values({
          bookId: input.bookId,
          chapterIndex: input.chapterIndex,
          summary: input.summary,
          titleIdeaAlignment: input.titleIdeaAlignment,
          flatnessRisk: input.flatnessRisk,
          characterChangesJson: JSON.stringify(input.characterChanges),
          relationshipChangesJson: JSON.stringify(input.relationshipChanges),
          worldFactsJson: JSON.stringify(input.worldFacts),
          threadUpdatesJson: JSON.stringify(input.threadUpdates),
          unresolvedPromisesJson: JSON.stringify(input.unresolvedPromises),
          stageProgress: input.stageProgress,
          remainingChapterBudget: input.remainingChapterBudget,
          createdAt,
        })
        .onConflictDoUpdate({
          target: [
            storyStateSnapshots.bookId,
            storyStateSnapshots.chapterIndex,
          ],
          set: {
            summary: input.summary,
            titleIdeaAlignment: input.titleIdeaAlignment,
            flatnessRisk: input.flatnessRisk,
            characterChangesJson: JSON.stringify(input.characterChanges),
            relationshipChangesJson: JSON.stringify(input.relationshipChanges),
            worldFactsJson: JSON.stringify(input.worldFacts),
            threadUpdatesJson: JSON.stringify(input.threadUpdates),
            unresolvedPromisesJson: JSON.stringify(input.unresolvedPromises),
            stageProgress: input.stageProgress,
            remainingChapterBudget: input.remainingChapterBudget,
            createdAt,
          },
        })
        .run();
    },

    getLatestByBook(bookId: string) {
      const row = drizzleDb
        .select({
          bookId: storyStateSnapshots.bookId,
          chapterIndex: storyStateSnapshots.chapterIndex,
          summary: storyStateSnapshots.summary,
          titleIdeaAlignment: storyStateSnapshots.titleIdeaAlignment,
          flatnessRisk: storyStateSnapshots.flatnessRisk,
          characterChangesJson: storyStateSnapshots.characterChangesJson,
          relationshipChangesJson: storyStateSnapshots.relationshipChangesJson,
          worldFactsJson: storyStateSnapshots.worldFactsJson,
          threadUpdatesJson: storyStateSnapshots.threadUpdatesJson,
          unresolvedPromisesJson: storyStateSnapshots.unresolvedPromisesJson,
          stageProgress: storyStateSnapshots.stageProgress,
          remainingChapterBudget: storyStateSnapshots.remainingChapterBudget,
          createdAt: storyStateSnapshots.createdAt,
        })
        .from(storyStateSnapshots)
        .where(eq(storyStateSnapshots.bookId, bookId))
        .orderBy(desc(storyStateSnapshots.chapterIndex))
        .limit(1)
        .get() as
        | {
            bookId: string;
            chapterIndex: number;
            summary: string;
            titleIdeaAlignment: string;
            flatnessRisk: string;
            characterChangesJson: string;
            relationshipChangesJson: string;
            worldFactsJson: string;
            threadUpdatesJson: string;
            unresolvedPromisesJson: string;
            stageProgress: string;
            remainingChapterBudget: number;
            createdAt: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        bookId: row.bookId,
        chapterIndex: row.chapterIndex,
        summary: row.summary,
        titleIdeaAlignment: row.titleIdeaAlignment,
        flatnessRisk: row.flatnessRisk,
        characterChanges: JSON.parse(row.characterChangesJson) as unknown,
        relationshipChanges: JSON.parse(row.relationshipChangesJson) as unknown,
        worldFacts: JSON.parse(row.worldFactsJson) as unknown,
        threadUpdates: JSON.parse(row.threadUpdatesJson) as unknown,
        unresolvedPromises: JSON.parse(row.unresolvedPromisesJson) as unknown,
        stageProgress: row.stageProgress,
        remainingChapterBudget: row.remainingChapterBudget,
        createdAt: row.createdAt,
      };
    },
  };
}
