import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { BookRecord } from '@story-weaver/shared/contracts';
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
  return {
    create(input: NewBookInput) {
      const now = new Date().toISOString();

      db.prepare(
        `
          INSERT INTO books (
            id,
            title,
            idea,
            status,
            model_id,
            target_chapters,
            words_per_chapter,
            viral_strategy_json,
            created_at,
            updated_at
          )
          VALUES (
            @id,
            @title,
            @idea,
            'creating',
            '',
            @targetChapters,
            @wordsPerChapter,
            @viralStrategyJson,
            @createdAt,
            @updatedAt
          )
        `
      ).run({
        ...input,
        modelId: '',
        viralStrategyJson: input.viralStrategy
          ? JSON.stringify(input.viralStrategy)
          : null,
        createdAt: now,
        updatedAt: now,
      });
    },

    list(): BookRecord[] {
      const rows = db
        .prepare(
          `
            SELECT
              id,
              title,
              idea,
              status,
              target_chapters AS targetChapters,
              words_per_chapter AS wordsPerChapter,
              viral_strategy_json AS viralStrategyJson,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM books
            ORDER BY created_at DESC
          `
        )
        .all() as BookRow[];

      return rows.map(mapBookRow);
    },

    getById(bookId: string) {
      const row = db
        .prepare(
          `
            SELECT
              id,
              title,
              idea,
              status,
              target_chapters AS targetChapters,
              words_per_chapter AS wordsPerChapter,
              viral_strategy_json AS viralStrategyJson,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM books
            WHERE id = ?
          `
        )
        .get(bookId) as BookRow | undefined;

      return row ? mapBookRow(row) : undefined;
    },

    updateStatus(bookId: string, status: BookRecord['status']) {
      db.prepare(
        `
          UPDATE books
          SET status = ?, updated_at = ?
          WHERE id = ?
        `
      ).run(status, new Date().toISOString(), bookId);
    },

    updateTitle(bookId: string, title: string) {
      db.prepare(
        `
          UPDATE books
          SET title = ?, updated_at = ?
          WHERE id = ?
        `
      ).run(title, new Date().toISOString(), bookId);
    },

    saveContext(input: {
      bookId: string;
      worldSetting: string;
      outline: string;
      styleGuide?: string | null;
    }) {
      db.prepare(
        `
          INSERT INTO book_context (book_id, world_setting, outline, style_guide)
          VALUES (@bookId, @worldSetting, @outline, @styleGuide)
          ON CONFLICT(book_id) DO UPDATE SET
            world_setting = excluded.world_setting,
            outline = excluded.outline,
            style_guide = excluded.style_guide
        `
      ).run({
        bookId: input.bookId,
        worldSetting: input.worldSetting,
        outline: input.outline,
        styleGuide: input.styleGuide ?? null,
      });
    },

    getContext(bookId: string) {
      return db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              world_setting AS worldSetting,
              outline,
              style_guide AS styleGuide
            FROM book_context
            WHERE book_id = ?
          `
        )
        .get(bookId) as
        | {
            bookId: string;
            worldSetting: string;
            outline: string;
            styleGuide: string | null;
          }
        | undefined;
    },

    clearGeneratedState(bookId: string) {
      deleteBookPlanningData(db, bookId);
      db.prepare('DELETE FROM book_context WHERE book_id = ?').run(bookId);
      db.prepare('DELETE FROM world_settings WHERE book_id = ?').run(bookId);
      db.prepare('DELETE FROM api_logs WHERE book_id = ?').run(bookId);
    },

    delete(bookId: string) {
      deleteBookPlanningData(db, bookId);
      db.prepare('DELETE FROM book_context WHERE book_id = ?').run(bookId);
      db.prepare('DELETE FROM world_settings WHERE book_id = ?').run(bookId);
      db.prepare('DELETE FROM api_logs WHERE book_id = ?').run(bookId);
      db.prepare('DELETE FROM books WHERE id = ?').run(bookId);
    },
  };
}
