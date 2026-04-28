import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { BookRecord } from '../shared/contracts.js';

type NewBookInput = Pick<
  BookRecord,
  'id' | 'title' | 'idea' | 'targetChapters' | 'wordsPerChapter'
>;

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
            @createdAt,
            @updatedAt
          )
        `
      ).run({
        ...input,
        modelId: '',
        createdAt: now,
        updatedAt: now,
      });
    },

    list(): BookRecord[] {
      return db
        .prepare(
          `
            SELECT
              id,
              title,
              idea,
              status,
              target_chapters AS targetChapters,
              words_per_chapter AS wordsPerChapter,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM books
            ORDER BY updated_at DESC
          `
        )
        .all() as BookRecord[];
    },

    getById(bookId: string) {
      return db
        .prepare(
          `
            SELECT
              id,
              title,
              idea,
              status,
              target_chapters AS targetChapters,
              words_per_chapter AS wordsPerChapter,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM books
            WHERE id = ?
          `
        )
        .get(bookId) as BookRecord | undefined;
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

    delete(bookId: string) {
      db.prepare('DELETE FROM book_context WHERE book_id = ?').run(bookId);
      db.prepare('DELETE FROM world_settings WHERE book_id = ?').run(bookId);
      db.prepare('DELETE FROM api_logs WHERE book_id = ?').run(bookId);
      db.prepare('DELETE FROM books WHERE id = ?').run(bookId);
    },
  };
}
