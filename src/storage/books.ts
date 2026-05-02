import { desc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { apiLogs, bookContext, books, worldSettings } from '../db/schema/index.js';
import type { BookRecord } from '../shared/contracts.js';
import { deleteBookPlanningData } from './book-graph.js';

type NewBookInput = Pick<
  BookRecord,
  'id' | 'title' | 'idea' | 'targetChapters' | 'wordsPerChapter' | 'viralStrategy'
>;

type BookRow = Omit<BookRecord, 'viralStrategy'> & {
  viralStrategyJson: string | null;
};

function parseViralStrategy(value: string | null) {
  if (!value) return null;
  return JSON.parse(value) as BookRecord['viralStrategy'];
}

function mapBookRow(row: BookRow): BookRecord {
  const { viralStrategyJson, ...book } = row;
  return {
    ...book,
    viralStrategy: parseViralStrategy(viralStrategyJson),
  };
}

export function createBookRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    create(input: NewBookInput) {
      const now = new Date().toISOString();

      drizzleDb.insert(books).values({
        id: input.id,
        title: input.title,
        idea: input.idea,
        status: 'creating',
        modelId: '',
        targetChapters: input.targetChapters,
        wordsPerChapter: input.wordsPerChapter,
        viralStrategyJson: input.viralStrategy
          ? JSON.stringify(input.viralStrategy)
          : null,
        createdAt: now,
        updatedAt: now,
      }).run();
    },

    list(): BookRecord[] {
      const rows = drizzleDb
        .select({
          id: books.id,
          title: books.title,
          idea: books.idea,
          status: books.status,
          targetChapters: books.targetChapters,
          wordsPerChapter: books.wordsPerChapter,
          viralStrategyJson: books.viralStrategyJson,
          createdAt: books.createdAt,
          updatedAt: books.updatedAt,
        })
        .from(books)
        .orderBy(desc(books.createdAt))
        .all() as BookRow[];

      return rows.map(mapBookRow);
    },

    getById(bookId: string) {
      const row = drizzleDb
        .select({
          id: books.id,
          title: books.title,
          idea: books.idea,
          status: books.status,
          targetChapters: books.targetChapters,
          wordsPerChapter: books.wordsPerChapter,
          viralStrategyJson: books.viralStrategyJson,
          createdAt: books.createdAt,
          updatedAt: books.updatedAt,
        })
        .from(books)
        .where(eq(books.id, bookId))
        .get() as BookRow | undefined;

      return row ? mapBookRow(row) : undefined;
    },

    updateStatus(bookId: string, status: BookRecord['status']) {
      drizzleDb
        .update(books)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(books.id, bookId))
        .run();
    },

    updateTitle(bookId: string, title: string) {
      drizzleDb
        .update(books)
        .set({ title, updatedAt: new Date().toISOString() })
        .where(eq(books.id, bookId))
        .run();
    },

    saveContext(input: {
      bookId: string;
      worldSetting: string;
      outline: string;
      styleGuide?: string | null;
    }) {
      drizzleDb
        .insert(bookContext)
        .values({
          bookId: input.bookId,
          worldSetting: input.worldSetting,
          outline: input.outline,
          styleGuide: input.styleGuide ?? null,
        })
        .onConflictDoUpdate({
          target: bookContext.bookId,
          set: {
            worldSetting: input.worldSetting,
            outline: input.outline,
            styleGuide: input.styleGuide ?? null,
          },
        })
        .run();
    },

    getContext(bookId: string) {
      const row = drizzleDb
        .select({
          bookId: bookContext.bookId,
          worldSetting: bookContext.worldSetting,
          outline: bookContext.outline,
          styleGuide: bookContext.styleGuide,
        })
        .from(bookContext)
        .where(eq(bookContext.bookId, bookId))
        .get() as
        | {
            bookId: string;
            worldSetting: string | null;
            outline: string | null;
            styleGuide: string | null;
          }
        | undefined;

      if (!row) {
        return undefined;
      }

      return {
        bookId: row.bookId,
        worldSetting: row.worldSetting ?? '',
        outline: row.outline ?? '',
        styleGuide: row.styleGuide,
      };
    },

    clearGeneratedState(bookId: string) {
      deleteBookPlanningData(db, bookId);
      drizzleDb.delete(bookContext).where(eq(bookContext.bookId, bookId)).run();
      drizzleDb.delete(worldSettings).where(eq(worldSettings.bookId, bookId)).run();
      drizzleDb.delete(apiLogs).where(eq(apiLogs.bookId, bookId)).run();
    },

    delete(bookId: string) {
      deleteBookPlanningData(db, bookId);
      drizzleDb.delete(bookContext).where(eq(bookContext.bookId, bookId)).run();
      drizzleDb.delete(worldSettings).where(eq(worldSettings.bookId, bookId)).run();
      drizzleDb.delete(apiLogs).where(eq(apiLogs.bookId, bookId)).run();
      drizzleDb.delete(books).where(eq(books.id, bookId)).run();
    },
  };
}
