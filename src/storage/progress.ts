import type { Database as SqliteDatabase } from 'better-sqlite3';

export function createProgressRepository(db: SqliteDatabase) {
  return {
    updatePhase(bookId: string, phase: string) {
      db.prepare(
        `
          INSERT INTO writing_progress (
            book_id,
            phase
          )
          VALUES (?, ?)
          ON CONFLICT(book_id) DO UPDATE SET
            phase = excluded.phase
        `
      ).run(bookId, phase);
    },

    getByBookId(bookId: string) {
      return db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              current_volume AS currentVolume,
              current_chapter AS currentChapter,
              phase,
              retry_count AS retryCount,
              error_msg AS errorMsg
            FROM writing_progress
            WHERE book_id = ?
          `
        )
        .get(bookId) as
        | {
            bookId: string;
            currentVolume: number | null;
            currentChapter: number | null;
            phase: string | null;
            retryCount: number;
            errorMsg: string | null;
          }
        | undefined;
    },

    reset(bookId: string, phase: string) {
      db.prepare(
        `
          INSERT INTO writing_progress (
            book_id,
            current_volume,
            current_chapter,
            phase,
            retry_count,
            error_msg
          )
          VALUES (?, NULL, NULL, ?, 0, NULL)
          ON CONFLICT(book_id) DO UPDATE SET
            current_volume = NULL,
            current_chapter = NULL,
            phase = excluded.phase,
            retry_count = 0,
            error_msg = NULL
        `
      ).run(bookId, phase);
    },

    deleteByBook(bookId: string) {
      db.prepare('DELETE FROM writing_progress WHERE book_id = ?').run(bookId);
    },
  };
}
