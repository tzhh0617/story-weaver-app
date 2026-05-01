import type { Database as SqliteDatabase } from 'better-sqlite3';

export function createPlotThreadRepository(db: SqliteDatabase) {
  return {
    upsertThread(input: {
      id: string;
      bookId: string;
      description: string;
      plantedAt: number;
      expectedPayoff?: number | null;
      resolvedAt?: number | null;
      importance?: string | null;
    }) {
      db.prepare(
        `
          INSERT INTO plot_threads (
            id,
            book_id,
            description,
            planted_at,
            expected_payoff,
            resolved_at,
            importance
          )
          VALUES (
            @id,
            @bookId,
            @description,
            @plantedAt,
            @expectedPayoff,
            @resolvedAt,
            @importance
          )
          ON CONFLICT(book_id, id) DO UPDATE SET
            description = excluded.description,
            planted_at = excluded.planted_at,
            expected_payoff = excluded.expected_payoff,
            resolved_at = excluded.resolved_at,
            importance = excluded.importance
        `
      ).run({
        ...input,
        expectedPayoff: input.expectedPayoff ?? null,
        resolvedAt: input.resolvedAt ?? null,
        importance: input.importance ?? 'normal',
      });
    },

    resolveThread(bookId: string, id: string, resolvedAt: number) {
      db.prepare(
        `
          UPDATE plot_threads
          SET resolved_at = ?
          WHERE book_id = ? AND id = ?
        `
      ).run(resolvedAt, bookId, id);
    },

    listByBook(bookId: string) {
      return db
        .prepare(
          `
            SELECT
              id,
              book_id AS bookId,
              description,
              planted_at AS plantedAt,
              expected_payoff AS expectedPayoff,
              resolved_at AS resolvedAt,
              importance
            FROM plot_threads
            WHERE book_id = ?
            ORDER BY planted_at ASC, id ASC
          `
        )
        .all(bookId) as Array<{
        id: string;
        bookId: string;
        description: string;
        plantedAt: number;
        expectedPayoff: number | null;
        resolvedAt: number | null;
        importance: string;
      }>;
    },

    clearByBook(bookId: string) {
      db.prepare('DELETE FROM plot_threads WHERE book_id = ?').run(bookId);
    },
  };
}
