import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { storyEvents } from '../db/schema/index.js';

export type StoryEvent = {
  id: string;
  bookId: string;
  chapterIndex: number;
  eventType: string;
  summary: string;
  affectedIds: string[];
  irreversible: boolean;
};

export function createStoryEventRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    appendMany(inputs: StoryEvent[]) {
      if (inputs.length === 0) {
        return;
      }

      const createdAt = new Date().toISOString();

      drizzleDb
        .insert(storyEvents)
        .values(
          inputs.map((input) => ({
            id: input.id,
            bookId: input.bookId,
            chapterIndex: input.chapterIndex,
            eventType: input.eventType,
            summary: input.summary,
            affectedIdsJson: JSON.stringify(input.affectedIds),
            irreversible: input.irreversible,
            createdAt,
          }))
        )
        .run();
    },

    listByBook(bookId: string) {
      return drizzleDb
        .select({
          id: storyEvents.id,
          bookId: storyEvents.bookId,
          chapterIndex: storyEvents.chapterIndex,
          eventType: storyEvents.eventType,
          summary: storyEvents.summary,
          affectedIdsJson: storyEvents.affectedIdsJson,
          irreversible: storyEvents.irreversible,
          createdAt: storyEvents.createdAt,
        })
        .from(storyEvents)
        .where(eq(storyEvents.bookId, bookId))
        .orderBy(asc(storyEvents.chapterIndex), asc(storyEvents.createdAt), asc(storyEvents.id))
        .all()
        .map((row) => {
          const typed = row as {
            id: string;
            bookId: string;
            chapterIndex: number;
            eventType: string;
            summary: string;
            affectedIdsJson: string;
            irreversible: boolean;
            createdAt: string;
          };

          return {
            id: typed.id,
            bookId: typed.bookId,
            chapterIndex: typed.chapterIndex,
            eventType: typed.eventType,
            summary: typed.summary,
            affectedIds: JSON.parse(typed.affectedIdsJson) as string[],
            irreversible: typed.irreversible,
            createdAt: typed.createdAt,
          };
        });
    },
  };
}
