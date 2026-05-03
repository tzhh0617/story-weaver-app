import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { storyEvents } from '../db/schema/index.js';

export type StoryEventType =
  | 'mainline_advance'
  | 'subplot_shift'
  | 'promise_opened'
  | 'promise_paid'
  | 'character_turn'
  | 'relationship_turn'
  | 'world_change'
  | 'cost_paid';

export type StoryEvent = {
  id: string;
  bookId: string;
  chapterIndex: number;
  eventType: StoryEventType;
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

      const batchStart = Date.now();

      drizzleDb
        .insert(storyEvents)
        .values(
          inputs.map((input, index) => ({
            id: input.id,
            bookId: input.bookId,
            chapterIndex: input.chapterIndex,
            eventType: input.eventType,
            summary: input.summary,
            affectedIdsJson: JSON.stringify(input.affectedIds),
            irreversible: input.irreversible,
            createdAt: new Date(batchStart + index).toISOString(),
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
            eventType: StoryEventType;
            summary: string;
            affectedIdsJson: string;
            irreversible: boolean;
            createdAt: string;
          };

          return {
            id: typed.id,
            bookId: typed.bookId,
            chapterIndex: typed.chapterIndex,
            eventType: typed.eventType as StoryEventType,
            summary: typed.summary,
            affectedIds: JSON.parse(typed.affectedIdsJson) as string[],
            irreversible: typed.irreversible,
            createdAt: typed.createdAt,
          };
        });
    },
  };
}
