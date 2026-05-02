import type { Database as SqliteDatabase } from 'better-sqlite3';

export function createProgressRepository(db: SqliteDatabase) {
  return {
    updatePhase(
      bookId: string,
      phase: string,
      metadata?: {
        currentVolume?: number | null;
        currentChapter?: number | null;
        stepLabel?: string | null;
        errorMsg?: string | null;
      }
    ) {
      db.prepare(
        `
          INSERT INTO writing_progress (
            book_id,
            current_volume,
            current_chapter,
            phase,
            step_label,
            error_msg
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(book_id) DO UPDATE SET
            current_volume = excluded.current_volume,
            current_chapter = excluded.current_chapter,
            phase = excluded.phase,
            step_label = excluded.step_label,
            error_msg = excluded.error_msg
        `
      ).run(
        bookId,
        metadata?.currentVolume ?? null,
        metadata?.currentChapter ?? null,
        phase,
        metadata?.stepLabel ?? null,
        metadata?.errorMsg ?? null
      );
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
              step_label AS stepLabel,
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
            stepLabel: string | null;
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
            step_label,
            retry_count,
            error_msg
          )
          VALUES (?, NULL, NULL, ?, NULL, 0, NULL)
          ON CONFLICT(book_id) DO UPDATE SET
            current_volume = NULL,
            current_chapter = NULL,
            phase = excluded.phase,
            step_label = NULL,
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
