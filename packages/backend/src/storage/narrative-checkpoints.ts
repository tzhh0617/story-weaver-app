import type { Database as SqliteDatabase } from 'better-sqlite3';

export function createNarrativeCheckpointRepository(db: SqliteDatabase) {
  return {
    save(input: {
      bookId: string;
      chapterIndex: number;
      report?: unknown;
      checkpointType?: string;
      arcReport?: unknown;
      threadDebt?: unknown;
      pacingReport?: unknown;
      replanningNotes?: string | null;
      futureCardRevisions?: unknown[];
    }) {
      const report =
        input.report ?? {
          checkpointType: input.checkpointType,
          arcReport: input.arcReport,
          threadDebt: input.threadDebt,
          pacingReport: input.pacingReport,
          replanningNotes: input.replanningNotes ?? null,
        };
      db.prepare(
        `
          INSERT INTO narrative_checkpoints (
            book_id, chapter_index, report_json, future_card_revisions_json, created_at
          )
          VALUES (
            @bookId, @chapterIndex, @reportJson, @futureCardRevisionsJson, @createdAt
          )
        `
      ).run({
        bookId: input.bookId,
        chapterIndex: input.chapterIndex,
        reportJson: JSON.stringify(report),
        futureCardRevisionsJson: JSON.stringify(input.futureCardRevisions ?? []),
        createdAt: new Date().toISOString(),
      });
    },

    listByBook(bookId: string) {
      return db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              chapter_index AS chapterIndex,
              report_json AS reportJson,
              future_card_revisions_json AS futureCardRevisionsJson,
              created_at AS createdAt
            FROM narrative_checkpoints
            WHERE book_id = ?
            ORDER BY chapter_index ASC, id ASC
          `
        )
        .all(bookId)
        .map((row) => {
          const typed = row as {
            bookId: string;
            chapterIndex: number;
            reportJson: string;
            futureCardRevisionsJson: string;
            createdAt: string;
          };
          return {
            bookId: typed.bookId,
            chapterIndex: typed.chapterIndex,
            checkpointType: (JSON.parse(typed.reportJson) as { checkpointType?: string })
              .checkpointType,
            report: JSON.parse(typed.reportJson) as unknown,
            futureCardRevisions: JSON.parse(typed.futureCardRevisionsJson) as unknown[],
            createdAt: typed.createdAt,
          };
        });
    },
  };
}
